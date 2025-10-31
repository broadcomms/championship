import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

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

  async createSubscription(userId: string, input: CreateSubscriptionInput): Promise<{
    subscriptionId: string;
    status: string;
  }> {
    const db = this.getDb();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied: Only workspace owner can manage subscriptions');
    }

    // Get plan details
    const plan = await db.selectFrom('subscription_plans').selectAll().where('id', '=', input.planId).executeTakeFirst();

    if (!plan) {
      throw new Error('Invalid plan');
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

    // For demo purposes, create subscription without actual Stripe call
    // In production, you would call Stripe API here
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const periodEnd = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    await db
      .insertInto('subscriptions')
      .values({
        id: subscriptionId,
        workspace_id: input.workspaceId,
        plan_id: input.planId,
        stripe_customer_id: null, // Would be from Stripe
        stripe_subscription_id: null, // Would be from Stripe
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: 0,
        created_at: now,
        updated_at: now,
      })
      .execute();

    this.env.logger.info(`Subscription created: ${subscriptionId} for workspace ${input.workspaceId}`);

    return {
      subscriptionId,
      status: 'active',
    };
  }

  async updateSubscription(userId: string, input: UpdateSubscriptionInput): Promise<{
    success: boolean;
    newPlanId: string;
  }> {
    const db = this.getDb();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied');
    }

    // Get subscription
    const subscription = await db
      .selectFrom('subscriptions')
      .selectAll()
      .where('workspace_id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Update subscription (in production, update Stripe first)
    await db
      .updateTable('subscriptions')
      .set({
        plan_id: input.planId,
        updated_at: Date.now(),
      })
      .where('workspace_id', '=', input.workspaceId)
      .execute();

    this.env.logger.info(`Subscription updated to plan ${input.planId} for workspace ${input.workspaceId}`);

    return {
      success: true,
      newPlanId: input.planId,
    };
  }

  async cancelSubscription(userId: string, input: CancelSubscriptionInput): Promise<{
    success: boolean;
    cancelAtPeriodEnd: boolean;
  }> {
    const db = this.getDb();

    // Verify workspace ownership
    const workspace = await db
      .selectFrom('workspaces')
      .select(['id', 'owner_id'])
      .where('id', '=', input.workspaceId)
      .executeTakeFirst();

    if (!workspace || workspace.owner_id !== userId) {
      throw new Error('Access denied');
    }

    const now = Date.now();

    if (input.cancelAtPeriodEnd) {
      // Cancel at end of billing period
      await db
        .updateTable('subscriptions')
        .set({
          cancel_at_period_end: 1,
          updated_at: now,
        })
        .where('workspace_id', '=', input.workspaceId)
        .execute();
    } else {
      // Cancel immediately
      await db
        .updateTable('subscriptions')
        .set({
          status: 'canceled',
          updated_at: now,
        })
        .where('workspace_id', '=', input.workspaceId)
        .execute();
    }

    this.env.logger.info(`Subscription canceled for workspace ${input.workspaceId}`);

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
      const resourceTypeMap = {
        compliance_checks: 'compliance_check',
        api_calls: 'api_call',
        assistant_messages: 'assistant_message',
      };

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
}
