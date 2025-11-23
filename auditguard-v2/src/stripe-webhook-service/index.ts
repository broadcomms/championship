import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import Stripe from 'stripe';
import {
  createSubscriptionCreatedNotification,
  createPaymentSucceededNotification,
  createPaymentFailedNotification,
  createSubscriptionCanceledNotification
} from '../common/notification-helper';

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
        this.env.logger.error('Missing stripe-signature header');
        return new Response('Missing signature', { status: 400 });
      }

      // Verify webhook signature
      let event: Stripe.Event;
      try {
        // CRITICAL: Use the webhook secret from stripe listen CLI
        const webhookSecret = 'whsec_ec6166a03ec5f61b17017039dd78e8e94951d56a5fde2ea6964dae284e240689';
        
        this.env.logger.info(`Attempting signature verification`, {
          signatureLength: signature.length,
          bodyLength: body.length,
          secretPrefix: webhookSecret.substring(0, 10),
        });
        
        // Use constructEventAsync for Cloudflare Workers (SubtleCrypto is async)
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        
        this.env.logger.info(`Webhook signature verified successfully`, {
          eventType: event.type,
          eventId: event.id,
        });
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
      // Checkout events
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

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

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    this.env.logger.info(`Checkout session completed: ${session.id}`);

    // Get organization_id from metadata
    const organizationId = session.metadata?.organization_id;
    if (!organizationId) {
      this.env.logger.error(`Checkout session ${session.id} missing organization_id in metadata`);
      return;
    }

    // Update organization with Stripe customer ID if not already set
    if (session.customer && typeof session.customer === 'string') {
      await db
        .updateTable('organizations')
        .set({
          stripe_customer_id: session.customer,
          updated_at: Date.now(),
        })
        .where('id', '=', organizationId)
        .where('stripe_customer_id', 'is', null)  // Only update if not already set
        .execute();

      this.env.logger.info(`Updated organization ${organizationId} with customer ${session.customer}`);
    }

    // If there's a subscription, retrieve it and process it
    if (session.subscription && typeof session.subscription === 'string') {
      try {
        // Retrieve the full subscription object from Stripe
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Process the subscription (this will handle creating/updating the subscription record)
        await this.handleSubscriptionUpdate(subscription);

        this.env.logger.info(`Processed subscription ${subscription.id} from checkout session ${session.id}`);
      } catch (error) {
        this.env.logger.error(`Failed to retrieve subscription ${session.subscription}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const db = this.getDb();

    // Support both organization-based and workspace-based billing
    const organizationId = subscription.metadata.organization_id;
    const workspaceId = subscription.metadata.workspace_id;

    if (!organizationId && !workspaceId) {
      this.env.logger.error(`Subscription ${subscription.id} missing organization_id or workspace_id in metadata`);
      return;
    }

    this.env.logger.info(`Processing subscription ${subscription.id} for ${organizationId ? `organization ${organizationId}` : `workspace ${workspaceId}`}`);

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

      this.env.logger.info(`Updated subscription ${subscription.id} for ${organizationId ? `organization ${organizationId}` : `workspace ${workspaceId}`}`);
    } else {
      // Get organization_id from Stripe metadata or lookup from workspace
      let orgId = organizationId;  // Use organizationId from top of function
      if (!orgId && workspaceId) {
        // If we have workspace_id but not organization_id, look it up
        const workspace = await db
          .selectFrom('workspaces')
          .select(['organization_id'])
          .where('id', '=', workspaceId)
          .executeTakeFirst();
        if (!workspace || !workspace.organization_id) {
          throw new Error('Workspace organization not found');
        }
        orgId = workspace.organization_id;
      }

      if (!orgId) {
        this.env.logger.error(`Cannot create subscription ${subscription.id}: no organization_id found`);
        return;
      }

      // Create new subscription
      await db
        .insertInto('subscriptions')
        .values({
          id: subscription.id,
          organization_id: orgId,
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

      this.env.logger.info(`Created subscription ${subscription.id} for organization ${orgId}`);

      // Create subscription notification for organization owner
      try {
        // Get organization owner
        const organization = await db
          .selectFrom('organizations')
          .select(['owner_user_id'])
          .where('id', '=', orgId)
          .executeTakeFirst();

        if (organization) {
          // Get plan details for notification
          const planDetails = await db
            .selectFrom('subscription_plans')
            .select(['display_name', 'price_monthly'])
            .where('id', '=', plan.id)
            .executeTakeFirst();

          if (planDetails) {
            const nextBillingDate = new Date((subscription as any).current_period_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            await createSubscriptionCreatedNotification(
              this.env as any,
              organization.owner_user_id,
              orgId,
              planDetails.display_name,
              planDetails.price_monthly,
              nextBillingDate
            );
          }
        }
      } catch (notificationError) {
        // Don't fail if notification fails
        this.env.logger.error('Failed to create subscription notification', {
          error: notificationError instanceof Error ? notificationError.message : String(notificationError),
          subscriptionId: subscription.id
        });
      }
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const db = this.getDb();
    const now = Date.now();

    // Get subscription and organization details before deletion
    const subscriptionDetails = await db
      .selectFrom('subscriptions')
      .innerJoin('organizations', 'organizations.id', 'subscriptions.organization_id')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select([
        'subscriptions.organization_id',
        'subscriptions.current_period_end',
        'organizations.owner_user_id',
        'subscription_plans.display_name'
      ])
      .where('stripe_subscription_id', '=', subscription.id)
      .executeTakeFirst();

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

    // Create subscription canceled notification
    if (subscriptionDetails) {
      try {
        const endDate = new Date(subscriptionDetails.current_period_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        await createSubscriptionCanceledNotification(
          this.env as any,
          subscriptionDetails.owner_user_id,
          subscriptionDetails.organization_id,
          subscriptionDetails.display_name,
          endDate
        );
      } catch (notificationError) {
        this.env.logger.error('Failed to create subscription canceled notification', {
          error: notificationError instanceof Error ? notificationError.message : String(notificationError),
          subscriptionId: subscription.id
        });
      }
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const db = this.getDb();
    const customerId = invoice.customer as string;

    // Get organization and user data from customer
    const result = await db
      .selectFrom('subscriptions')
      .innerJoin('organizations', 'organizations.id', 'subscriptions.organization_id')
      .innerJoin('users', 'users.id', 'organizations.owner_user_id')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select([
        'subscriptions.organization_id',
        'organizations.name as organization_name',
        'users.email as owner_email',
        'subscription_plans.display_name as plan_name',
      ])
      .where('subscriptions.stripe_customer_id', '=', customerId)
      .executeTakeFirst();

    if (!result) {
      this.env.logger.error(`Organization not found for customer ${customerId}`);
      return;
    }

    // Store billing history - update to use organization_id
    // Note: billing_history table may need migration to support organization_id
    // For now, we'll skip this or use workspace_id if available
    const now = Date.now();

    // Send invoice receipt email
    const userName = result.owner_email.split('@')[0];
    const billingDate = new Date(invoice.created * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    try {
      await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
        type: 'invoice_receipt',
        to: result.owner_email,
        data: {
          userName,
          organizationName: result.organization_name,
          amount: invoice.total,
          invoiceNumber: invoice.number || invoice.id,
          invoiceUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || '#',
          billingDate,
          planName: result.plan_name,
        },
      });

      this.env.logger.info(`Invoice receipt email queued for ${result.owner_email}`, {
        invoiceId: invoice.id,
        organizationId: result.organization_id,
      });
    } catch (error) {
      this.env.logger.error(`Failed to queue invoice receipt email`, {
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.env.logger.info(`Invoice ${invoice.id} payment succeeded for organization ${result.organization_id}`);

    // Create payment success notification for organization owner
    try {
      const ownerUser = await db
        .selectFrom('organizations')
        .select(['owner_user_id'])
        .where('id', '=', result.organization_id)
        .executeTakeFirst();

      if (ownerUser) {
        await createPaymentSucceededNotification(
          this.env as any,
          ownerUser.owner_user_id,
          result.organization_id,
          invoice.total || 0,
          invoice.hosted_invoice_url || undefined
        );
      }
    } catch (notificationError) {
      this.env.logger.error('Failed to create payment notification', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        invoiceId: invoice.id
      });
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const db = this.getDb();
    const customerId = invoice.customer as string;
    const stripe = this.getStripeClient();

    // Get organization and user data from customer
    const result = await db
      .selectFrom('subscriptions')
      .innerJoin('organizations', 'organizations.id', 'subscriptions.organization_id')
      .innerJoin('users', 'users.id', 'organizations.owner_user_id')
      .select([
        'subscriptions.organization_id',
        'subscriptions.id as subscription_id',
        'subscriptions.stripe_subscription_id',
        'organizations.name as organization_name',
        'users.email as owner_email',
      ])
      .where('subscriptions.stripe_customer_id', '=', customerId)
      .executeTakeFirst();

    if (!result) {
      this.env.logger.error(`Organization not found for customer ${customerId}`);
      return;
    }

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

    // Get payment method details for the email
    const userName = result.owner_email.split('@')[0];
    let lastFourDigits = '****';
    let retryDate: string | undefined;

    try {
      // Get default payment method from customer
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && 'invoice_settings' in customer) {
        const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;
        if (defaultPaymentMethodId) {
          const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId as string);
          lastFourDigits = paymentMethod.card?.last4 || '****';
        }
      }

      // Calculate next retry date if available
      if (invoice.next_payment_attempt) {
        retryDate = new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch (error) {
      this.env.logger.error('Failed to fetch payment method details', {
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Send payment failed email
    try {
      await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
        type: 'payment_failed',
        to: result.owner_email,
        data: {
          userName,
          organizationName: result.organization_name,
          amount: invoice.amount_due,
          lastFourDigits,
          retryDate,
        },
      });

      this.env.logger.info(`Payment failed email queued for ${result.owner_email}`, {
        invoiceId: invoice.id,
        organizationId: result.organization_id,
      });
    } catch (error) {
      this.env.logger.error(`Failed to queue payment failed email`, {
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.env.logger.info(`Invoice ${invoice.id} payment failed for organization ${result.organization_id}`);

    // Create payment failed notification for organization owner
    try {
      const ownerUser = await db
        .selectFrom('organizations')
        .select(['owner_user_id'])
        .where('id', '=', result.organization_id)
        .executeTakeFirst();

      if (ownerUser) {
        await createPaymentFailedNotification(
          this.env as any,
          ownerUser.owner_user_id,
          result.organization_id,
          invoice.amount_due || 0,
          'Payment method declined. Please update your payment information.'
        );
      }
    } catch (notificationError) {
      this.env.logger.error('Failed to create payment failed notification', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        invoiceId: invoice.id
      });
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
