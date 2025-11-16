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
      .innerJoin('organizations', 'organizations.id', 'subscriptions.organization_id')
      .innerJoin('users', 'users.id', 'organizations.owner_user_id')
      .select([
        'subscriptions.id as subscription_id',
        'subscriptions.organization_id',
        'subscriptions.trial_end',
        'organizations.name as organization_name',
        'users.email as owner_email',
        'users.id as user_id',
      ])
      .where('subscriptions.status', '=', 'trialing')
      .where('subscriptions.trial_end', '<', now)
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
          .where('id', '=', trial.subscription_id)
          .execute();

        downgradedOrgs.push(trial.organization_id);

        // Get user's name from email (use first part before @)
        const userName = trial.owner_email.split('@')[0];

        // Send trial expired notification email (async via queue)
        await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
          type: 'trial_expired',
          to: trial.owner_email,
          data: {
            userName,
            organizationName: trial.organization_name,
          },
        });

        this.env.logger.info('Trial expired - downgraded to free plan and sent email', {
          subscriptionId: trial.subscription_id,
          organizationId: trial.organization_id,
          ownerEmail: trial.owner_email,
          trialEnd: new Date(trial.trial_end || 0).toISOString(),
        });
      } catch (error) {
        this.env.logger.error('Failed to downgrade expired trial', {
          subscriptionId: trial.subscription_id,
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
   * Check for trials expiring soon and send warning emails
   * Sends warnings at 7 days, 3 days, and 1 day before expiration
   */
  async checkTrialWarnings(): Promise<{ warningsCount: number }> {
    const db = this.getDb();
    const now = Date.now();

    // Calculate time thresholds
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const oneDay = 1 * 24 * 60 * 60 * 1000;
    const twoHours = 2 * 60 * 60 * 1000; // Buffer to avoid duplicate sends

    // Find trials expiring in the next 7 days
    const expiringTrials = await db
      .selectFrom('subscriptions')
      .innerJoin('organizations', 'organizations.id', 'subscriptions.organization_id')
      .innerJoin('users', 'users.id', 'organizations.owner_user_id')
      .select([
        'subscriptions.id as subscription_id',
        'subscriptions.organization_id',
        'subscriptions.trial_end',
        'organizations.name as organization_name',
        'users.email as owner_email',
      ])
      .where('subscriptions.status', '=', 'trialing')
      .where('subscriptions.trial_end', '>', now)
      .where('subscriptions.trial_end', '<', now + sevenDays)
      .execute();

    let warningsCount = 0;

    for (const trial of expiringTrials) {
      if (!trial.trial_end) continue;

      const timeUntilExpiry = trial.trial_end - now;
      const daysRemaining = Math.ceil(timeUntilExpiry / (24 * 60 * 60 * 1000));

      // Determine if we should send a warning
      let shouldSend = false;
      if (timeUntilExpiry <= oneDay + twoHours && timeUntilExpiry > oneDay - twoHours) {
        // 1 day remaining (with 2-hour buffer)
        shouldSend = true;
      } else if (timeUntilExpiry <= threeDays + twoHours && timeUntilExpiry > threeDays - twoHours) {
        // 3 days remaining
        shouldSend = true;
      } else if (timeUntilExpiry <= sevenDays + twoHours && timeUntilExpiry > sevenDays - twoHours) {
        // 7 days remaining
        shouldSend = true;
      }

      if (shouldSend) {
        try {
          const userName = trial.owner_email.split('@')[0];
          const trialEndDate = new Date(trial.trial_end).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          // Send trial expiration warning email (async via queue)
          await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
            type: 'trial_expiration_warning',
            to: trial.owner_email,
            data: {
              userName,
              organizationName: trial.organization_name,
              daysRemaining,
              trialEndDate,
            },
          });

          warningsCount++;

          this.env.logger.info('Trial expiration warning sent', {
            organizationId: trial.organization_id,
            ownerEmail: trial.owner_email,
            daysRemaining,
            trialEnd: trialEndDate,
          });
        } catch (error) {
          this.env.logger.error('Failed to send trial warning', {
            organizationId: trial.organization_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { warningsCount };
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
      // Check for expired trials and downgrade them
      const expiredResult = await this.checkExpiredTrials();

      // Check for trials expiring soon and send warnings
      const warningsResult = await this.checkTrialWarnings();

      this.env.logger.info('Trial expiry check completed', {
        expiredCount: expiredResult.expiredCount,
        downgradedCount: expiredResult.downgradedOrgs.length,
        warningsCount: warningsResult.warningsCount,
      });
    } catch (error) {
      this.env.logger.error('Trial expiry check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
