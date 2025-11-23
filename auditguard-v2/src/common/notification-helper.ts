/**
 * Notification Helper Module
 * 
 * Provides clean, type-safe methods for creating notifications across all services.
 * This ensures consistency and reduces code duplication.
 */

// Generic Env type that works across all services
interface NotificationEnv {
  NOTIFICATION_SERVICE: {
    createNotification(params: any): Promise<Response>;
  };
  logger: {
    info(message: string, data?: any): void;
    error(message: string, data?: any): void;
  };
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  source: NotificationSource;
  title: string;
  message: string;
  actionUrl: string;
  workspaceId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
  sendRealtime?: boolean;
  actions?: NotificationAction[];
}

export type NotificationType = 
  // Workspace notifications
  | 'issue_assigned'
  | 'comment'
  | 'mention'
  | 'status_change'
  | 'workspace_invite'
  | 'due_date_reminder'
  | 'overdue_alert'
  // AI notifications
  | 'ai_compliance_alert'
  | 'ai_recommendation'
  | 'ai_issue_detected'
  | 'ai_report_ready'
  | 'ai_insight'
  // System notifications
  | 'welcome'
  | 'trial_started'
  | 'trial_warning'
  | 'trial_expired'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'invoice_ready';

export type NotificationCategory = 'ai' | 'workspace' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationSource = 'ai_assistant' | 'workspace' | 'system';

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'danger';
}

/**
 * Create a notification via the notification service
 */
export async function createNotification(
  env: NotificationEnv,
  params: CreateNotificationParams
): Promise<void> {
  try {
    const requestBody = {
      user_id: params.userId,
      type: params.type,
      category: params.category,
      priority: params.priority,
      source: params.source,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl,
      workspace_id: params.workspaceId,
      metadata: params.metadata,
      send_email: params.sendEmail ?? false, // Don't send email by default (already sent)
      send_realtime: params.sendRealtime ?? true,
      actions: params.actions
    };

    // Call notification service method directly
    const response = await env.NOTIFICATION_SERVICE.createNotification(requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create notification: ${response.status} - ${errorText}`);
    }

    env.logger.info('Notification created successfully', {
      userId: params.userId,
      type: params.type,
      category: params.category
    });
  } catch (error) {
    // Don't fail the main operation if notifications fail
    env.logger.error('Failed to create notification', {
      error: error instanceof Error ? error.message : String(error),
      userId: params.userId,
      type: params.type
    });
  }
}

/**
 * Create welcome notification for new users
 */
export async function createWelcomeNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  trialEndDate: string
): Promise<void> {
  await createNotification(env, {
    userId,
    type: 'welcome',
    category: 'system',
    priority: 'medium',
    source: 'system',
    title: '🎉 Welcome to AuditGuardX!',
    message: `Your 14-day Professional trial is now active! Explore unlimited compliance checks, AI assistance, and more. Trial ends ${trialEndDate}.`,
    actionUrl: `/org/${organizationId}`,
    organizationId,
    metadata: {
      trialEndDate,
      planName: 'Professional Trial'
    },
    actions: [
      { id: '1', label: 'Get Started', action: 'view', style: 'primary' },
      { id: '2', label: 'Dismiss', action: 'dismiss', style: 'secondary' }
    ]
  });
}

/**
 * Create trial started notification
 */
export async function createTrialStartedNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  trialDays: number,
  trialEndDate: string
): Promise<void> {
  await createNotification(env, {
    userId,
    type: 'trial_started',
    category: 'system',
    priority: 'medium',
    source: 'system',
    title: `🚀 Your ${trialDays}-Day Professional Trial Has Started`,
    message: `You now have access to all Professional features. Make the most of your trial before it ends on ${trialEndDate}.`,
    actionUrl: `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      trialDays,
      trialEndDate,
      planName: 'Professional'
    },
    actions: [
      { id: '1', label: 'Explore Features', action: 'view', style: 'primary' },
      { id: '2', label: 'View Plans', action: 'view_plans', style: 'secondary' }
    ]
  });
}

/**
 * Create trial warning notification
 */
export async function createTrialWarningNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  daysRemaining: number
): Promise<void> {
  const urgency = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'high' : 'medium';
  const emoji = daysRemaining <= 1 ? '🚨' : '⏰';

  await createNotification(env, {
    userId,
    type: 'trial_warning',
    category: 'system',
    priority: urgency,
    source: 'system',
    title: `${emoji} Trial Ending ${daysRemaining === 1 ? 'Tomorrow' : `in ${daysRemaining} Days`}`,
    message: `Your Professional trial will end soon. Upgrade now to keep access to all features.`,
    actionUrl: `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      daysRemaining
    },
    actions: [
      { id: '1', label: 'Upgrade Now', action: 'upgrade', style: 'primary' },
      { id: '2', label: 'View Plans', action: 'view_plans', style: 'secondary' }
    ]
  });
}

/**
 * Create trial expired notification
 */
export async function createTrialExpiredNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string
): Promise<void> {
  await createNotification(env, {
    userId,
    type: 'trial_expired',
    category: 'system',
    priority: 'high',
    source: 'system',
    title: '⏰ Your Trial Has Ended',
    message: `You've been moved to the Free plan. Upgrade to Professional to restore full access to advanced features.`,
    actionUrl: `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      previousPlan: 'Professional',
      currentPlan: 'Free'
    },
    actions: [
      { id: '1', label: 'Upgrade Now', action: 'upgrade', style: 'primary' },
      { id: '2', label: 'Compare Plans', action: 'view_plans', style: 'secondary' }
    ]
  });
}

/**
 * Create subscription created notification
 */
export async function createSubscriptionCreatedNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  planName: string,
  amount: number,
  nextBillingDate: string
): Promise<void> {
  const formattedAmount = (amount / 100).toFixed(2);

  await createNotification(env, {
    userId,
    type: 'subscription_created',
    category: 'system',
    priority: 'medium',
    source: 'system',
    title: `✅ ${planName} Subscription Active`,
    message: `Your subscription is now active! You'll be billed $${formattedAmount}/month. Next billing date: ${nextBillingDate}.`,
    actionUrl: `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      planName,
      amount,
      nextBillingDate
    },
    actions: [
      { id: '1', label: 'View Billing', action: 'view', style: 'primary' }
    ]
  });
}

/**
 * Create payment succeeded notification
 */
export async function createPaymentSucceededNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  amount: number,
  invoiceUrl?: string
): Promise<void> {
  const formattedAmount = (amount / 100).toFixed(2);

  await createNotification(env, {
    userId,
    type: 'payment_succeeded',
    category: 'system',
    priority: 'low',
    source: 'system',
    title: '✅ Payment Received',
    message: `Your payment of $${formattedAmount} has been processed successfully. Thank you!`,
    actionUrl: invoiceUrl || `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      amount,
      invoiceUrl
    },
    actions: invoiceUrl ? [
      { id: '1', label: 'View Invoice', action: 'view', style: 'primary' }
    ] : undefined
  });
}

/**
 * Create payment failed notification
 */
export async function createPaymentFailedNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  amount: number,
  reason?: string
): Promise<void> {
  const formattedAmount = (amount / 100).toFixed(2);

  await createNotification(env, {
    userId,
    type: 'payment_failed',
    category: 'system',
    priority: 'critical',
    source: 'system',
    title: '🚨 Payment Failed - Action Required',
    message: `Your payment of $${formattedAmount} failed. ${reason || 'Please update your payment method to avoid service interruption.'}`,
    actionUrl: `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      amount,
      reason
    },
    actions: [
      { id: '1', label: 'Update Payment', action: 'update_payment', style: 'primary' },
      { id: '2', label: 'Contact Support', action: 'support', style: 'secondary' }
    ]
  });
}

/**
 * Create subscription canceled notification
 */
export async function createSubscriptionCanceledNotification(
  env: NotificationEnv,
  userId: string,
  organizationId: string,
  planName: string,
  endDate: string
): Promise<void> {
  await createNotification(env, {
    userId,
    type: 'subscription_canceled',
    category: 'system',
    priority: 'medium',
    source: 'system',
    title: '❌ Subscription Canceled',
    message: `Your ${planName} subscription has been canceled. You'll have access until ${endDate}.`,
    actionUrl: `/org/${organizationId}/billing`,
    organizationId,
    metadata: {
      planName,
      endDate
    },
    actions: [
      { id: '1', label: 'Reactivate', action: 'reactivate', style: 'primary' },
      { id: '2', label: 'View Plans', action: 'view_plans', style: 'secondary' }
    ]
  });
}
