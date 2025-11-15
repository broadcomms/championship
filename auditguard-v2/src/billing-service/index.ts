import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import Stripe from 'stripe';

interface CreateSubscriptionInput {
  workspaceId: string;
  planId: string;
  paymentMethodId?: string;
}

interface UpdateSubscriptionInput {
  workspaceId: string;
  planId: string;
}

interface CancelSubscriptionInput {
  workspaceId: string;
  cancelAtPeriodEnd: boolean;
}

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

  async fetch(_request: Request): Promise<Response> {
    return new Response('Billing Service - Private', { status: 501 });
  }

  async getPlans(): Promise<{
    plans: Array<{
      id: string;
      name: string;
      displayName: string;
      description: string | null;
      priceMonthly: number;
      priceYearly: number;
      features: string[];
      limits: Record<string, number>;
    }>;
  }> {
    const db = this.getDb();

    const plans = await db.selectFrom('subscription_plans').selectAll().where('is_active', '=', 1).execute();

    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        features: JSON.parse(plan.features),
        limits: JSON.parse(plan.limits),
      })),
    };
  }

  async getWorkspaceSubscription(workspaceId: string, userId: string): Promise<{
    subscription: {
      id: string;
      planId: string;
      planName: string;
      status: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
    } | null;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    const subscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscriptions.plan_id', 'subscription_plans.id')
      .select([
        'subscriptions.id',
        'subscriptions.plan_id',
        'subscription_plans.display_name as plan_name',
        'subscriptions.status',
        'subscriptions.current_period_start',
        'subscriptions.current_period_end',
        'subscriptions.cancel_at_period_end',
      ])
      .where('subscriptions.workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!subscription) {
      // No subscription, return free plan info
      return { subscription: null };
    }

    return {
      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
        planName: subscription.plan_name,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end === 1,
      },
    };
  }

  async syncSubscriptionStatus(workspaceId: string, userId: string): Promise<{ success: boolean }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Get subscription from database
    const subscription = await db
      .selectFrom('subscriptions')
      .select(['id', 'stripe_subscription_id'])
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!subscription || !subscription.stripe_subscription_id) {
      throw new Error('No Stripe subscription found');
    }

    // Fetch latest subscription status from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    // Update database with latest status
    // Note: current_period_start and current_period_end may be null for incomplete subscriptions
    const now = Date.now();
    await db
      .updateTable('subscriptions')
      .set({
        status: stripeSubscription.status,
        current_period_start: (stripeSubscription as any).current_period_start 
          ? (stripeSubscription as any).current_period_start * 1000 
          : null,
        current_period_end: (stripeSubscription as any).current_period_end 
          ? (stripeSubscription as any).current_period_end * 1000 
          : null,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end ? 1 : 0,
        canceled_at: stripeSubscription.canceled_at ? stripeSubscription.canceled_at * 1000 : null,
        updated_at: now,
      })
      .where('id', '=', subscription.id)
      .execute();

    this.env.logger.info(`Synced subscription ${subscription.id} status: ${stripeSubscription.status}`);

    return { success: true };
  }

  async createStripeCustomer(workspaceId: string, email: string): Promise<{ customerId: string }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Check if customer already exists
    const existing = await (db as any)
      .selectFrom('stripe_customers')
      .select('stripe_customer_id')
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (existing) {
      return { customerId: existing.stripe_customer_id };
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: { workspace_id: workspaceId },
    });

    // Store in database
    const now = Date.now();
    await (db as any)
      .insertInto('stripe_customers')
      .values({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        stripe_customer_id: customer.id,
        email,
        payment_method_id: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    this.env.logger.info(`Stripe customer created: ${customer.id} for workspace ${workspaceId}`);

    return { customerId: customer.id };
  }

  async createSubscription(
    userId: string,
    input: CreateSubscriptionInput
  ): Promise<{
    subscriptionId: string;
    status: string;
    clientSecret?: string;
  }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Verify workspace ownership and get user email
    const workspace = await db
      .selectFrom('workspaces')
      .innerJoin('users', 'workspaces.owner_id', 'users.id')
      .select(['workspaces.id', 'workspaces.owner_id', 'users.email'])
      .where('workspaces.id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied: Only workspace owner can manage subscriptions');
    }

    // Get plan details with Stripe price ID
    const plan = await db
      .selectFrom('subscription_plans')
      .selectAll()
      .where('id', '=', input.planId)
      .executeTakeFirst();

    if (!plan || !plan.stripe_price_id_monthly) {
      throw new Error('Invalid plan or Stripe price not configured');
    }

    // Check if subscription already exists
    const existing = await db
      .selectFrom('subscriptions')
      .select('id')
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (existing) {
      throw new Error('Subscription already exists. Use update endpoint to change plans.');
    }

    // Create or get Stripe customer
    const { customerId } = await this.createStripeCustomer(input.workspaceId, workspace.email);

    // Attach payment method if provided
    if (input.paymentMethodId) {
      await stripe.paymentMethods.attach(input.paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: input.paymentMethodId,
        },
      });

      // Store payment method in database
      const pm = await stripe.paymentMethods.retrieve(input.paymentMethodId);
      await (db as any)
        .insertInto('stripe_payment_methods')
        .values({
          id: crypto.randomUUID(),
          workspace_id: input.workspaceId,
          stripe_payment_method_id: pm.id,
          type: pm.type,
          last4: pm.card?.last4 || null,
          brand: pm.card?.brand || null,
          exp_month: pm.card?.exp_month || null,
          exp_year: pm.card?.exp_year || null,
          is_default: 1,
          created_at: Date.now(),
        })
        .execute();
    }

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripe_price_id_monthly }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { workspace_id: input.workspaceId },
    });

    this.env.logger.info(`Stripe subscription status: ${stripeSubscription.status}`);

    // Store subscription in database
    const now = Date.now();
    // Handle incomplete subscriptions that don't have period dates yet
    const periodStart = (stripeSubscription as any).current_period_start
      ? (stripeSubscription as any).current_period_start * 1000
      : now;
    const periodEnd = (stripeSubscription as any).current_period_end
      ? (stripeSubscription as any).current_period_end * 1000
      : now + 30 * 24 * 60 * 60 * 1000; // 30 days from now as fallback

    await db
      .insertInto('subscriptions')
      .values({
        id: stripeSubscription.id,
        workspace_id: input.workspaceId,
        plan_id: input.planId,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscription.id,
        stripe_price_id: plan.stripe_price_id_monthly,
        status: stripeSubscription.status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: 0,
        trial_end: (stripeSubscription as any).trial_end ? (stripeSubscription as any).trial_end * 1000 : null,
        canceled_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    this.env.logger.info(`Stripe subscription created: ${stripeSubscription.id} for workspace ${input.workspaceId}`);

    // Return client secret for payment confirmation
    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as any)?.payment_intent as Stripe.PaymentIntent;

    return {
      subscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      clientSecret: paymentIntent?.client_secret || undefined,
    };
  }

  async updateSubscription(userId: string, input: UpdateSubscriptionInput): Promise<{
    success: boolean;
    newPlanId: string;
    status?: string;
    clientSecret?: string;
    subscriptionId?: string;
  }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied: Only workspace owner can manage subscriptions');
    }

    // Get current subscription
    const subscription = await db
      .selectFrom('subscriptions')
      .selectAll()
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!subscription || !subscription.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    // Get new plan details with Stripe price ID
    const newPlan = await db
      .selectFrom('subscription_plans')
      .selectAll()
      .where('id', '=', input.planId)
      .executeTakeFirst();

    if (!newPlan || !newPlan.stripe_price_id_monthly) {
      throw new Error('Invalid plan or Stripe price not configured');
    }

    // If already on this plan, no changes needed
    if (subscription.plan_id === input.planId) {
      return {
        success: true,
        newPlanId: input.planId,
      };
    }

    // Get current Stripe subscription to find the subscription item
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    if (!stripeSubscription.items.data[0]) {
      throw new Error('No subscription items found');
    }

    // Update Stripe subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripe_price_id_monthly,
        },
      ],
      proration_behavior: 'create_prorations', // Prorate the difference
      expand: ['latest_invoice.payment_intent'], // Expand to get payment intent if needed
    });

    // Update local database
    // Handle incomplete subscriptions that don't have period dates yet
    const updatePeriodStart = (updatedSubscription as any).current_period_start
      ? (updatedSubscription as any).current_period_start * 1000
      : Date.now();
    const updatePeriodEnd = (updatedSubscription as any).current_period_end
      ? (updatedSubscription as any).current_period_end * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;

    await db
      .updateTable('subscriptions')
      .set({
        plan_id: input.planId,
        stripe_price_id: newPlan.stripe_price_id_monthly,
        status: updatedSubscription.status,
        current_period_start: updatePeriodStart,
        current_period_end: updatePeriodEnd,
        updated_at: Date.now(),
      })
      .where('workspace_id', '=', input.workspaceId)
      .execute();

    this.env.logger.info(`Stripe subscription ${subscription.stripe_subscription_id} updated to plan ${input.planId} for workspace ${input.workspaceId}, status: ${updatedSubscription.status}`);

    // Get payment intent client secret if subscription requires payment
    const invoice = updatedSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as any)?.payment_intent as Stripe.PaymentIntent;

    return {
      success: true,
      newPlanId: input.planId,
      status: updatedSubscription.status,
      clientSecret: paymentIntent?.client_secret || undefined,
      subscriptionId: updatedSubscription.id,
    };
  }

  async cancelSubscription(userId: string, input: CancelSubscriptionInput): Promise<{
    success: boolean;
    cancelAtPeriodEnd: boolean;
  }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied: Only workspace owner can manage subscriptions');
    }

    // Get current subscription
    const subscription = await db
      .selectFrom('subscriptions')
      .selectAll()
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!subscription || !subscription.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    const now = Date.now();

    if (input.cancelAtPeriodEnd) {
      // Schedule cancellation at end of billing period
      const updatedSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Update local database
      await db
        .updateTable('subscriptions')
        .set({
          cancel_at_period_end: 1,
          status: updatedSubscription.status,
          updated_at: now,
        })
        .where('workspace_id', '=', input.workspaceId)
        .execute();

      this.env.logger.info(
        `Stripe subscription ${subscription.stripe_subscription_id} scheduled for cancellation at period end for workspace ${input.workspaceId}`
      );
    } else {
      // Cancel immediately
      const canceledSubscription = await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

      // Update local database
      await db
        .updateTable('subscriptions')
        .set({
          status: 'canceled',
          canceled_at: canceledSubscription.canceled_at ? canceledSubscription.canceled_at * 1000 : now,
          cancel_at_period_end: 0,
          updated_at: now,
        })
        .where('workspace_id', '=', input.workspaceId)
        .execute();

      this.env.logger.info(
        `Stripe subscription ${subscription.stripe_subscription_id} canceled immediately for workspace ${input.workspaceId}`
      );
    }

    return {
      success: true,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    };
  }

  async checkLimit(
    workspaceId: string,
    limitType: 'documents' | 'compliance_checks' | 'api_calls' | 'assistant_messages'
  ): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    percentage: number;
  }> {
    const db = this.getDb();

    // Get subscription
    const subscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscriptions.plan_id', 'subscription_plans.id')
      .select(['subscription_plans.limits'])
      .where('subscriptions.workspace_id', '=', workspaceId)
      .where('subscriptions.status', '=', 'active')
      .executeTakeFirst();

    let limits: Record<string, number>;
    if (!subscription) {
      // Free plan limits
      limits = {
        documents: 10,
        compliance_checks: 20,
        api_calls: 1000,
        assistant_messages: 50,
      };
    } else {
      limits = JSON.parse(subscription.limits);
    }

    const limit = limits[limitType];
    if (limit === undefined) {
      throw new Error(`Unknown limit type: ${limitType}`);
    }
    if (limit === -1) {
      // Unlimited
      return { allowed: true, current: 0, limit: -1, percentage: 0 };
    }

    // Get current usage
    let current = 0;
    const today = new Date().toISOString().split('T')[0]!;

    if (limitType === 'documents') {
      const count = await db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();
      current = count?.count || 0;
    } else {
      const summary = await db
        .selectFrom('usage_summaries')
        .selectAll()
        .where('workspace_id', '=', workspaceId)
        .where('date', '=', today)
        .executeTakeFirst();

      if (summary) {
        const fieldMap = {
          compliance_checks: summary.compliance_checks,
          api_calls: summary.api_calls,
          assistant_messages: summary.assistant_messages,
        };
        current = fieldMap[limitType] || 0;
      }
    }

    const percentage = limit > 0 ? (current / limit) * 100 : 0;
    const allowed = current < limit;

    return { allowed, current, limit, percentage };
  }

  async getWorkspaceLimits(workspaceId: string, userId: string): Promise<{
    workspaceId: string;
    planName: string;
    documentsLimit: number;
    documentsUsed: number;
    documentsPercentage: number;
    documentsAllowed: boolean;
    complianceChecksLimit: number;
    complianceChecksUsed: number;
    complianceChecksPercentage: number;
    complianceChecksAllowed: boolean;
    assistantMessagesLimit: number;
    assistantMessagesUsed: number;
    assistantMessagesPercentage: number;
    assistantMessagesAllowed: boolean;
    apiCallsLimit: number;
    apiCallsUsed: number;
    apiCallsPercentage: number;
    apiCallsAllowed: boolean;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Get subscription - include active, trialing, and incomplete (with periods) subscriptions
    const subscription = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscriptions.plan_id', 'subscription_plans.id')
      .select(['subscription_plans.limits', 'subscription_plans.display_name', 'subscriptions.status', 'subscriptions.current_period_start'])
      .where('subscriptions.workspace_id', '=', workspaceId)
      .where('subscriptions.status', 'in', ['active', 'trialing', 'incomplete', 'past_due'])
      .executeTakeFirst();

    let limits: Record<string, number>;
    let planName: string;

    if (!subscription) {
      // Free plan limits
      planName = 'Free';
      limits = {
        documents: 10,
        compliance_checks: 20,
        api_calls: 1000,
        assistant_messages: 50,
      };
    } else {
      planName = subscription.display_name;
      limits = JSON.parse(subscription.limits);
    }

    // Get current usage
    const today = new Date().toISOString().split('T')[0]!;

    // Documents count
    const docsCount = await db
      .selectFrom('documents')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();
    const documentsUsed = docsCount?.count || 0;

    // Other usage from summary table
    const summary = await db
      .selectFrom('usage_summaries')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('date', '=', today)
      .executeTakeFirst();

    const complianceChecksUsed = summary?.compliance_checks || 0;
    const apiCallsUsed = summary?.api_calls || 0;
    const assistantMessagesUsed = summary?.assistant_messages || 0;

    // Calculate percentages and allowed status for each limit
    const documentsLimit = limits.documents;
    const documentsPercentage = documentsLimit > 0 ? (documentsUsed / documentsLimit) * 100 : 0;
    const documentsAllowed = documentsLimit === -1 || documentsUsed < documentsLimit;

    const complianceChecksLimit = limits.compliance_checks;
    const complianceChecksPercentage = complianceChecksLimit > 0 ? (complianceChecksUsed / complianceChecksLimit) * 100 : 0;
    const complianceChecksAllowed = complianceChecksLimit === -1 || complianceChecksUsed < complianceChecksLimit;

    const apiCallsLimit = limits.api_calls;
    const apiCallsPercentage = apiCallsLimit > 0 ? (apiCallsUsed / apiCallsLimit) * 100 : 0;
    const apiCallsAllowed = apiCallsLimit === -1 || apiCallsUsed < apiCallsLimit;

    const assistantMessagesLimit = limits.assistant_messages;
    const assistantMessagesPercentage = assistantMessagesLimit > 0 ? (assistantMessagesUsed / assistantMessagesLimit) * 100 : 0;
    const assistantMessagesAllowed = assistantMessagesLimit === -1 || assistantMessagesUsed < assistantMessagesLimit;

    return {
      workspaceId,
      planName,
      documentsLimit,
      documentsUsed,
      documentsPercentage,
      documentsAllowed,
      complianceChecksLimit,
      complianceChecksUsed,
      complianceChecksPercentage,
      complianceChecksAllowed,
      assistantMessagesLimit,
      assistantMessagesUsed,
      assistantMessagesPercentage,
      assistantMessagesAllowed,
      apiCallsLimit,
      apiCallsUsed,
      apiCallsPercentage,
      apiCallsAllowed,
    };
  }

  async listPaymentMethods(workspaceId: string, userId: string): Promise<{
    paymentMethods: Array<{
      id: string;
      type: string;
      last4: string | null;
      brand: string | null;
      expMonth: number | null;
      expYear: number | null;
      isDefault: boolean;
    }>;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    const methods = await (db as any)
      .selectFrom('stripe_payment_methods')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .execute();

    // Deduplicate by stripe_payment_method_id (in case of duplicate entries)
    const uniqueMethods = new Map();
    for (const method of methods) {
      if (!uniqueMethods.has(method.stripe_payment_method_id)) {
        uniqueMethods.set(method.stripe_payment_method_id, method);
      }
    }

    return {
      paymentMethods: Array.from(uniqueMethods.values()).map((method: any) => ({
        id: method.stripe_payment_method_id,
        type: method.type,
        last4: method.last4,
        brand: method.brand,
        expMonth: method.exp_month,
        expYear: method.exp_year,
        isDefault: method.is_default === 1,
      })),
    };
  }

  async setDefaultPaymentMethod(
    workspaceId: string,
    userId: string,
    paymentMethodId: string
  ): Promise<{
    success: boolean;
  }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied: Only workspace owner can manage payment methods');
    }

    // Get Stripe customer
    const customer = await (db as any)
      .selectFrom('stripe_customers')
      .select('stripe_customer_id')
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!customer) {
      throw new Error('No Stripe customer found for workspace');
    }

    // Update in Stripe
    await stripe.customers.update(customer.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update in database - unset all defaults first
    await (db as any)
      .updateTable('stripe_payment_methods')
      .set({ is_default: 0 })
      .where('workspace_id', '=', workspaceId)
      .execute();

    // Set new default
    await (db as any)
      .updateTable('stripe_payment_methods')
      .set({ is_default: 1 })
      .where('workspace_id', '=', workspaceId)
      .where('stripe_payment_method_id', '=', paymentMethodId)
      .execute();

    this.env.logger.info(`Payment method ${paymentMethodId} set as default for workspace ${workspaceId}`);

    return { success: true };
  }

  async removePaymentMethod(
    workspaceId: string,
    userId: string,
    paymentMethodId: string
  ): Promise<{
    success: boolean;
  }> {
    const db = this.getDb();
    const stripe = this.getStripeClient();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied: Only workspace owner can manage payment methods');
    }

    // Check if this is the only payment method
    const methods = await (db as any)
      .selectFrom('stripe_payment_methods')
      .select('id')
      .where('workspace_id', '=', workspaceId)
      .execute();

    if (methods.length === 1) {
      throw new Error('Cannot remove the only payment method. Add another payment method first.');
    }

    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethodId);

    // Remove from database (webhook will also handle this, but we do it here for immediate effect)
    await (db as any)
      .deleteFrom('stripe_payment_methods')
      .where('workspace_id', '=', workspaceId)
      .where('stripe_payment_method_id', '=', paymentMethodId)
      .execute();

    this.env.logger.info(`Payment method ${paymentMethodId} removed for workspace ${workspaceId}`);

    return { success: true };
  }

  async getBillingHistory(workspaceId: string, userId: string): Promise<{
    history: Array<{
      id: string;
      invoiceId: string | null;
      amount: number;
      currency: string;
      status: string;
      description: string | null;
      invoicePdf: string | null;
      periodStart: number | null;
      periodEnd: number | null;
      createdAt: number;
    }>;
  }> {
    const db = this.getDb();

    // Verify workspace access
    const membership = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!membership) {
      throw new Error('Access denied');
    }

    const history = await (db as any)
      .selectFrom('billing_history')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();

    return {
      history: history.map((item: any) => ({
        id: item.id,
        invoiceId: item.stripe_invoice_id,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        description: item.description,
        invoicePdf: item.invoice_pdf,
        periodStart: item.period_start,
        periodEnd: item.period_end,
        createdAt: item.created_at,
      })),
    };
  }
}
