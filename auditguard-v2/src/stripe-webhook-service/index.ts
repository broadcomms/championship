import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import Stripe from 'stripe';

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  private getStripeClient(): Stripe {
    // TEMPORARY: Hardcoded TEST key to bypass environment variable issues
    const testKey = 'sk_test_51ISqyeHSX3RgJL1cYATfAtUz2mTheWpXfHE6CarZVJlLAsthLPSkMywCU4R4igxVYYtP2YDNCMq15ACNNewhnudb005xDmDDxm';
    return new Stripe(testKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const stripe = this.getStripeClient();
    const db = this.getDb();

    try {
      // Get the raw request body for signature verification
      const body = await request.text();
      const signature = request.headers.get('stripe-signature');

      if (!signature) {
        this.env.logger.error('Missing Stripe signature header');
        return new Response('Missing signature', { status: 400 });
      }

      // Verify webhook signature
      let event: Stripe.Event;
      try {
        // Use environment webhook secret (production) or fall back to stripe listen secret (development)
        // For production: Set STRIPE_WEBHOOK_SECRET in Stripe Dashboard after creating webhook endpoint
        // For development: This matches the secret from `stripe listen` command
        const webhookSecret = this.env.STRIPE_WEBHOOK_SECRET || 
          'whsec_ec6166a03ec5f61b17017039dd78e8e94951d56a5fde2ea6964dae284e240689';
        
        // Use constructEventAsync for Cloudflare Workers compatibility
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        this.env.logger.error(`Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
        return new Response('Invalid signature', { status: 400 });
      }

      // Check for duplicate events (idempotency)
      const existing = await (db as any)
        .selectFrom('stripe_webhooks')
        .select('id')
        .where('stripe_event_id', '=', event.id)
        .executeTakeFirst();

      if (existing) {
        this.env.logger.info(`Webhook event ${event.id} already processed, skipping`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Store webhook event
      const webhookId = crypto.randomUUID();
      const now = Date.now();
      await (db as any)
        .insertInto('stripe_webhooks')
        .values({
          id: webhookId,
          stripe_event_id: event.id,
          type: event.type,
          processed: 0,
          payload: JSON.stringify(event),
          created_at: now,
          error: null,
          processed_at: null,
        })
        .execute();

      // Process the event
      try {
        await this.processWebhookEvent(event);

        // Mark as processed
        await (db as any)
          .updateTable('stripe_webhooks')
          .set({
            processed: 1,
            processed_at: Date.now(),
          })
          .where('id', '=', webhookId)
          .execute();

        this.env.logger.info(`Successfully processed webhook event ${event.id} (${event.type})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.env.logger.error(`Error processing webhook event ${event.id}: ${errorMessage}`);

        // Update with error
        await (db as any)
          .updateTable('stripe_webhooks')
          .set({
            error: errorMessage,
            processed_at: Date.now(),
          })
          .where('id', '=', webhookId)
          .execute();

        // Return 500 so Stripe retries
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      this.env.logger.error(`Webhook handler error: ${error instanceof Error ? error.message : String(error)}`);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const db = this.getDb();

    switch (event.type) {
      // Customer events
      case 'customer.created':
        await this.handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      // Subscription lifecycle events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // Invoice events
      case 'invoice.payment_succeeded':
      case 'invoice.paid':  // Also handle manual Dashboard payments
      case 'invoice.finalized':  // Also handle finalized invoices (creates record immediately)
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Payment method events
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      // Customer events
      case 'customer.updated':
        await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      default:
        this.env.logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
    const db = this.getDb();
    const workspaceId = customer.metadata?.workspace_id;

    if (!workspaceId) {
      this.env.logger.warn(`Customer ${customer.id} created without workspace_id in metadata`);
      return;
    }

    // Check if customer already exists
    const existing = await (db as any)
      .selectFrom('stripe_customers')
      .select('id')
      .where('stripe_customer_id', '=', customer.id)
      .executeTakeFirst();

    if (existing) {
      this.env.logger.info(`Customer ${customer.id} already exists in database`);
      return;
    }

    // Insert customer into database
    const now = Date.now();
    await (db as any)
      .insertInto('stripe_customers')
      .values({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        stripe_customer_id: customer.id,
        email: customer.email || null,
        payment_method_id: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    this.env.logger.info(`Customer ${customer.id} created for workspace ${workspaceId}`);
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const db = this.getDb();
    const workspaceId = subscription.metadata.workspace_id;

    if (!workspaceId) {
      this.env.logger.error(`Subscription ${subscription.id} missing workspace_id in metadata`);
      return;
    }

    // Get the plan_id from the price
    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      this.env.logger.error(`Subscription ${subscription.id} has no price`);
      return;
    }

    // Find the plan by stripe_price_id
    const plan = await db
      .selectFrom('subscription_plans')
      .select('id')
      .where('stripe_price_id_monthly', '=', priceId)
      .executeTakeFirst();

    if (!plan) {
      this.env.logger.error(`No plan found for Stripe price ${priceId}`);
      return;
    }

    const now = Date.now();

    // Check if subscription exists
    const existing = await db
      .selectFrom('subscriptions')
      .select('id')
      .where('stripe_subscription_id', '=', subscription.id)
      .executeTakeFirst();

    if (existing) {
      // Update existing subscription
      await db
        .updateTable('subscriptions')
        .set({
          plan_id: plan.id,
          status: subscription.status,
          current_period_start: (subscription as any).current_period_start * 1000,
          current_period_end: (subscription as any).current_period_end * 1000,
          cancel_at_period_end: subscription.cancel_at_period_end ? 1 : 0,
          trial_end: (subscription as any).trial_end ? (subscription as any).trial_end * 1000 : null,
          canceled_at: subscription.canceled_at ? subscription.canceled_at * 1000 : null,
          updated_at: now,
        })
        .where('stripe_subscription_id', '=', subscription.id)
        .execute();

      this.env.logger.info(`Updated subscription ${subscription.id} for workspace ${workspaceId}`);
    } else {
      // Get organization_id from Stripe metadata or lookup from workspace
      let organizationId = subscription.metadata?.organization_id;
      if (!organizationId) {
        const workspace = await db
          .selectFrom('workspaces')
          .select(['organization_id'])
          .where('id', '=', workspaceId)
          .executeTakeFirst();
        if (!workspace || !workspace.organization_id) {
          throw new Error('Workspace organization not found');
        }
        organizationId = workspace.organization_id;
      }

      // Create new subscription
      await db
        .insertInto('subscriptions')
        .values({
          id: subscription.id,
          organization_id: organizationId,
          plan_id: plan.id,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          status: subscription.status,
          current_period_start: (subscription as any).current_period_start * 1000,
          current_period_end: (subscription as any).current_period_end * 1000,
          cancel_at_period_end: subscription.cancel_at_period_end ? 1 : 0,
          trial_end: (subscription as any).trial_end ? (subscription as any).trial_end * 1000 : null,
          canceled_at: subscription.canceled_at ? subscription.canceled_at * 1000 : null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      this.env.logger.info(`Created subscription ${subscription.id} for workspace ${workspaceId}`);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const db = this.getDb();
    const now = Date.now();

    await db
      .updateTable('subscriptions')
      .set({
        status: 'canceled',
        canceled_at: subscription.canceled_at ? subscription.canceled_at * 1000 : now,
        updated_at: now,
      })
      .where('stripe_subscription_id', '=', subscription.id)
      .execute();

    this.env.logger.info(`Subscription ${subscription.id} marked as canceled`);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const db = this.getDb();
    const customerId = invoice.customer as string;

    // Get workspace from customer
    const customer = await (db as any)
      .selectFrom('stripe_customers')
      .select('workspace_id')
      .where('stripe_customer_id', '=', customerId)
      .executeTakeFirst();

    if (!customer) {
      this.env.logger.error(`Customer ${customerId} not found in database`);
      return;
    }

    // Store billing history
    await (db as any)
      .insertInto('billing_history')
      .values({
        id: crypto.randomUUID(),
        workspace_id: customer.workspace_id,
        stripe_invoice_id: invoice.id,
        stripe_charge_id: (invoice as any).charge as string | null,
        amount: invoice.total, // Use total instead of amount_paid (handles paid_out_of_band invoices)
        currency: invoice.currency,
        status: 'paid',
        description: invoice.description || 'Subscription payment',
        invoice_pdf: invoice.invoice_pdf || null,
        period_start: invoice.period_start ? invoice.period_start * 1000 : null,
        period_end: invoice.period_end ? invoice.period_end * 1000 : null,
        created_at: Date.now(),
      })
      .execute();

    this.env.logger.info(`Invoice ${invoice.id} payment succeeded for workspace ${customer.workspace_id}`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const db = this.getDb();
    const customerId = invoice.customer as string;

    // Get workspace from customer
    const customer = await (db as any)
      .selectFrom('stripe_customers')
      .select('workspace_id')
      .where('stripe_customer_id', '=', customerId)
      .executeTakeFirst();

    if (!customer) {
      this.env.logger.error(`Customer ${customerId} not found in database`);
      return;
    }

    // Store billing history
    await (db as any)
      .insertInto('billing_history')
      .values({
        id: crypto.randomUUID(),
        workspace_id: customer.workspace_id,
        stripe_invoice_id: invoice.id,
        stripe_charge_id: (invoice as any).charge as string | null,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'payment_failed',
        description: invoice.description || 'Subscription payment failed',
        invoice_pdf: invoice.invoice_pdf || null,
        period_start: invoice.period_start ? invoice.period_start * 1000 : null,
        period_end: invoice.period_end ? invoice.period_end * 1000 : null,
        created_at: Date.now(),
      })
      .execute();

    this.env.logger.info(`Invoice ${invoice.id} payment failed for workspace ${customer.workspace_id}`);

    // Update subscription status if needed
    if ((invoice as any).subscription) {
      await db
        .updateTable('subscriptions')
        .set({
          status: 'past_due',
          updated_at: Date.now(),
        })
        .where('stripe_subscription_id', '=', (invoice as any).subscription as string)
        .execute();
    }
  }

  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    const db = this.getDb();
    const customerId = paymentMethod.customer as string;

    if (!customerId) {
      return;
    }

    // Get workspace from customer
    const customer = await (db as any)
      .selectFrom('stripe_customers')
      .select('workspace_id')
      .where('stripe_customer_id', '=', customerId)
      .executeTakeFirst();

    if (!customer) {
      this.env.logger.error(`Customer ${customerId} not found in database`);
      return;
    }

    // Check if payment method already exists
    const existing = await (db as any)
      .selectFrom('stripe_payment_methods')
      .select('id')
      .where('stripe_payment_method_id', '=', paymentMethod.id)
      .executeTakeFirst();

    if (!existing) {
      // Store payment method
      await (db as any)
        .insertInto('stripe_payment_methods')
        .values({
          id: crypto.randomUUID(),
          workspace_id: customer.workspace_id,
          stripe_payment_method_id: paymentMethod.id,
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4 || null,
          brand: paymentMethod.card?.brand || null,
          exp_month: paymentMethod.card?.exp_month || null,
          exp_year: paymentMethod.card?.exp_year || null,
          is_default: 0,
          created_at: Date.now(),
        })
        .execute();

      this.env.logger.info(`Payment method ${paymentMethod.id} attached for workspace ${customer.workspace_id}`);
    }
  }

  private async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    const db = this.getDb();

    // Remove payment method
    await (db as any)
      .deleteFrom('stripe_payment_methods')
      .where('stripe_payment_method_id', '=', paymentMethod.id)
      .execute();

    this.env.logger.info(`Payment method ${paymentMethod.id} detached`);
  }

  private async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    const db = this.getDb();

    // Update customer email if it changed
    if (customer.email) {
      await (db as any)
        .updateTable('stripe_customers')
        .set({
          email: customer.email,
          updated_at: Date.now(),
        })
        .where('stripe_customer_id', '=', customer.id)
        .execute();

      this.env.logger.info(`Customer ${customer.id} email updated to ${customer.email}`);
    }
  }
}
