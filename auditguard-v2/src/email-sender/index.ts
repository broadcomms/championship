import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';

/**
 * Email notification types supported by the queue
 */
export type EmailNotificationType =
  | 'welcome'
  | 'trial_expiration_warning'
  | 'trial_expired'
  | 'payment_failed'
  | 'invoice_receipt'
  | 'workspace_invitation'
  | 'issue_assignment'
  | 'document_processed'
  | 'document_processing_failed'
  | 'password-reset';

/**
 * Queue message body for email notifications
 */
export interface Body {
  type: EmailNotificationType;
  to: string;
  data: Record<string, any>;
}

/**
 * Email Sender Observer
 *
 * Processes email notifications from the email-notifications-queue
 * This allows email sending to happen asynchronously without blocking the main request
 */
export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { type, to, data } = message.body;

    this.env.logger.info('Processing email notification', {
      type,
      to,
      attempt: message.attempts,
      timestamp: Date.now(),
    });

    try {
      switch (type) {
        case 'welcome':
          await this.env.EMAIL_SERVICE.sendWelcomeEmail({
            to,
            userName: data.userName,
            organizationName: data.organizationName,
            trialEndDate: data.trialEndDate,
          });
          break;

        case 'trial_expiration_warning':
          await this.env.EMAIL_SERVICE.sendTrialExpirationWarning({
            to,
            userName: data.userName,
            organizationName: data.organizationName,
            daysRemaining: data.daysRemaining,
            trialEndDate: data.trialEndDate,
          });
          break;

        case 'trial_expired':
          await this.env.EMAIL_SERVICE.sendTrialExpired({
            to,
            userName: data.userName,
            organizationName: data.organizationName,
          });
          break;

        case 'payment_failed':
          await this.env.EMAIL_SERVICE.sendPaymentFailed({
            to,
            userName: data.userName,
            organizationName: data.organizationName,
            amount: data.amount,
            lastFourDigits: data.lastFourDigits,
            retryDate: data.retryDate,
          });
          break;

        case 'invoice_receipt':
          await this.env.EMAIL_SERVICE.sendInvoiceReceipt({
            to,
            userName: data.userName,
            organizationName: data.organizationName,
            amount: data.amount,
            invoiceNumber: data.invoiceNumber,
            invoiceUrl: data.invoiceUrl,
            billingDate: data.billingDate,
            planName: data.planName,
          });
          break;

        case 'workspace_invitation':
          await this.env.EMAIL_SERVICE.sendWorkspaceInvitation({
            to,
            inviterName: data.inviterName,
            workspaceName: data.workspaceName,
            role: data.role,
            invitationLink: data.invitationLink,
          });
          break;

        case 'issue_assignment':
          await this.env.EMAIL_SERVICE.sendIssueAssignment({
            to,
            assigneeName: data.assigneeName,
            assignerName: data.assignerName,
            issueTitle: data.issueTitle,
            workspaceName: data.workspaceName,
            severity: data.severity,
            issueUrl: data.issueUrl,
          });
          break;

        case 'document_processed':
          await this.env.EMAIL_SERVICE.sendDocumentProcessed({
            to,
            userName: data.userName,
            documentName: data.documentName,
            workspaceName: data.workspaceName,
            issuesFound: data.issuesFound,
            documentUrl: data.documentUrl,
          });
          break;

        case 'document_processing_failed':
          await this.env.EMAIL_SERVICE.sendDocumentProcessingFailed({
            to,
            userName: data.userName,
            documentName: data.documentName,
            workspaceName: data.workspaceName,
            errorMessage: data.errorMessage,
          });
          break;

        case 'password-reset':
          await this.env.EMAIL_SERVICE.sendPasswordReset({
            to,
            resetUrl: data.resetUrl,
            resetToken: data.resetToken,
          });
          break;

        default:
          this.env.logger.error('Unknown email notification type', { type });
          throw new Error(`Unknown email notification type: ${type}`);
      }

      this.env.logger.info('Email notification sent successfully', { type, to });
    } catch (error) {
      this.env.logger.error('Failed to send email notification', {
        type,
        to,
        error: String(error),
        attempt: message.attempts,
      });

      // Re-throw to trigger retry mechanism
      throw error;
    }
  }
}
