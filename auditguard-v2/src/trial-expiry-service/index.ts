import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Trial Expiry Service - Private', { status: 501 });
  }

  /**
   * Check for expired trials and downgrade to free plan
   * This should be called by a cron trigger every hour
   */
  async checkExpiredTrials(): Promise<{ expiredCount: number; downgradedOrgs: string[] }> {
    const db = this.getDb();
    const now = Date.now();

    // Find all subscriptions with expired trials that are still in trialing status
    const expiredTrials = await db
      .selectFrom('subscriptions')
      .select(['id', 'organization_id', 'trial_end'])
      .where('status', '=', 'trialing')
      .where('trial_end', '<', now)
      .execute();

    if (expiredTrials.length === 0) {
      this.env.logger.info('No expired trials found');
      return { expiredCount: 0, downgradedOrgs: [] };
    }

    const downgradedOrgs: string[] = [];

    // Downgrade each expired trial to free plan
    for (const trial of expiredTrials) {
      try {
        await db
          .updateTable('subscriptions')
          .set({
            plan_id: 'plan_free', // Downgrade to free plan
            status: 'active', // Change from trialing to active
            updated_at: now,
          })
          .where('id', '=', trial.id)
          .execute();

        downgradedOrgs.push(trial.organization_id);

        this.env.logger.info('Trial expired - downgraded to free plan', {
          subscriptionId: trial.id,
          organizationId: trial.organization_id,
          trialEnd: new Date(trial.trial_end || 0).toISOString(),
        });
      } catch (error) {
        this.env.logger.error('Failed to downgrade expired trial', {
          subscriptionId: trial.id,
          organizationId: trial.organization_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.env.logger.info('Expired trials processed', {
      total: expiredTrials.length,
      successful: downgradedOrgs.length,
    });

    return {
      expiredCount: expiredTrials.length,
      downgradedOrgs,
    };
  }

  /**
   * Get trial status for an organization
   */
  async getTrialStatus(organizationId: string): Promise<{
    isTrialing: boolean;
    trialStart: number | null;
    trialEnd: number | null;
    daysRemaining: number | null;
    currentPlan: string;
  } | null> {
    const db = this.getDb();

    const subscription = await db
      .selectFrom('subscriptions')
      .select(['status', 'plan_id', 'trial_start', 'trial_end'])
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();

    if (!subscription) {
      return null;
    }

    const now = Date.now();
    const isTrialing = subscription.status === 'trialing' && 
                       subscription.trial_end !== null && 
                       subscription.trial_end > now;

    let daysRemaining: number | null = null;
    if (isTrialing && subscription.trial_end) {
      const msRemaining = subscription.trial_end - now;
      daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    }

    return {
      isTrialing,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end,
      daysRemaining,
      currentPlan: subscription.plan_id,
    };
  }

  /**
   * Scheduled cron handler (runs every hour)
   */
  async scheduled(event: { scheduledTime: number; cron: string }): Promise<void> {
    this.env.logger.info('Trial expiry check triggered', {
      scheduledTime: new Date(event.scheduledTime).toISOString(),
      cron: event.cron,
    });

    try {
      const result = await this.checkExpiredTrials();
      
      this.env.logger.info('Trial expiry check completed', {
        expiredCount: result.expiredCount,
        downgradedCount: result.downgradedOrgs.length,
      });
    } catch (error) {
      this.env.logger.error('Trial expiry check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
