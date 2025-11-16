import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Email Service - Handles sending transactional emails via Resend API
 *
 * This service provides:
 * - Email template rendering
 * - Resend API integration
 * - Email sending methods for various notification types
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export default class extends Service<Env> {
  async fetch(_request: Request): Promise<Response> {
    return new Response('Email Service - Private', { status: 501 });
  }

  /**
   * Send email via Resend API
   */
  async sendEmail(params: SendEmailRequest): Promise<{ success: boolean; id?: string; error?: string }> {
    const { to, subject, html, text, replyTo } = params;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.env.EMAIL_FROM,
          to: [to],
          subject,
          html,
          text: text || this.stripHtml(html),
          reply_to: replyTo,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.env.logger.error('Failed to send email', { to, subject, error, status: response.status });
        return { success: false, error };
      }

      const result = await response.json() as { id: string };
      this.env.logger.info('Email sent successfully', { to, subject, id: result.id });
      return { success: true, id: result.id };
    } catch (error) {
      this.env.logger.error('Exception sending email', { to, subject, error: String(error) });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(params: {
    to: string;
    userName: string;
    organizationName: string;
    trialEndDate: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderWelcomeEmail(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send trial expiration warning email
   */
  async sendTrialExpirationWarning(params: {
    to: string;
    userName: string;
    organizationName: string;
    daysRemaining: number;
    trialEndDate: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderTrialExpirationWarning(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send trial expired notification
   */
  async sendTrialExpired(params: {
    to: string;
    userName: string;
    organizationName: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderTrialExpired(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(params: {
    to: string;
    userName: string;
    organizationName: string;
    amount: number;
    lastFourDigits: string;
    retryDate?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderPaymentFailed(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send invoice receipt
   */
  async sendInvoiceReceipt(params: {
    to: string;
    userName: string;
    organizationName: string;
    amount: number;
    invoiceNumber: string;
    invoiceUrl: string;
    billingDate: string;
    planName: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderInvoiceReceipt(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send workspace invitation
   */
  async sendWorkspaceInvitation(params: {
    to: string;
    inviterName: string;
    workspaceName: string;
    role: string;
    invitationLink: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderWorkspaceInvitation(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send issue assignment notification
   */
  async sendIssueAssignment(params: {
    to: string;
    assigneeName: string;
    assignerName: string;
    issueTitle: string;
    workspaceName: string;
    severity: string;
    issueUrl: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderIssueAssignment(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send document processing completed notification
   */
  async sendDocumentProcessed(params: {
    to: string;
    userName: string;
    documentName: string;
    workspaceName: string;
    issuesFound: number;
    documentUrl: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderDocumentProcessed(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send document processing failed notification
   */
  async sendDocumentProcessingFailed(params: {
    to: string;
    userName: string;
    documentName: string;
    workspaceName: string;
    errorMessage: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const template = this.renderDocumentProcessingFailed(params);
    return this.sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  /**
   * Welcome email for new user registration
   */
  private renderWelcomeEmail(params: {
    userName: string;
    organizationName: string;
    trialEndDate: string;
  }): EmailTemplate {
    const { userName, organizationName, trialEndDate } = params;

    return {
      subject: 'Welcome to AuditGuardX - Your 14-Day Professional Trial Starts Now',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .highlight { background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; }
            .feature-list { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature-item { padding: 8px 0; }
            .checkmark { color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 32px;">🎉 Welcome to AuditGuardX!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">AI-Powered Compliance Management Made Simple</p>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Welcome aboard! We're thrilled to have you join <strong>${organizationName}</strong> on AuditGuardX.</p>

              <div class="highlight">
                <strong>🚀 Your 14-Day Professional Trial is Now Active!</strong><br>
                Trial ends on ${trialEndDate} - Full access to all Professional features
              </div>

              <p><strong>What You Can Do With AuditGuardX:</strong></p>
              <div class="feature-list">
                <div class="feature-item"><span class="checkmark">✓</span> Upload and analyze compliance documents with AI</div>
                <div class="feature-item"><span class="checkmark">✓</span> Track compliance across 20+ regulatory frameworks (GDPR, HIPAA, SOC 2, etc.)</div>
                <div class="feature-item"><span class="checkmark">✓</span> Get instant AI-powered recommendations and gap analysis</div>
                <div class="feature-item"><span class="checkmark">✓</span> Collaborate with your team on compliance issues</div>
                <div class="feature-item"><span class="checkmark">✓</span> Generate compliance reports and dashboards</div>
              </div>

              <p><strong>Quick Start Guide:</strong></p>
              <ol>
                <li><strong>Create Your First Workspace</strong> - Organize your compliance projects</li>
                <li><strong>Upload Documents</strong> - Drag and drop your compliance files</li>
                <li><strong>Run AI Analysis</strong> - Get instant compliance insights</li>
                <li><strong>Invite Team Members</strong> - Collaborate on compliance management</li>
              </ol>

              <a href="https://app.auditguardx.com/dashboard" class="button">Go to Dashboard →</a>

              <p style="margin-top: 30px;"><strong>Need Help Getting Started?</strong></p>
              <p>Check out our <a href="https://docs.auditguardx.com" style="color: #2563eb;">documentation</a> or reply to this email - we're here to help!</p>

              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                <strong>What happens after the trial?</strong><br>
                On ${trialEndDate}, you'll automatically move to our Free plan unless you upgrade. You'll keep all your data and can upgrade anytime.
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuardX. All rights reserved.</p>
              <p>You're receiving this because you registered for AuditGuardX.</p>
              <p><a href="https://auditguardx.com/unsubscribe" style="color: #6b7280;">Unsubscribe</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${userName},

Welcome to AuditGuardX! We're thrilled to have you join ${organizationName}.

🚀 YOUR 14-DAY PROFESSIONAL TRIAL IS NOW ACTIVE!
Trial ends on ${trialEndDate} - Full access to all Professional features

WHAT YOU CAN DO WITH AUDITGUARDX:
✓ Upload and analyze compliance documents with AI
✓ Track compliance across 20+ regulatory frameworks (GDPR, HIPAA, SOC 2, etc.)
✓ Get instant AI-powered recommendations and gap analysis
✓ Collaborate with your team on compliance issues
✓ Generate compliance reports and dashboards

QUICK START GUIDE:
1. Create Your First Workspace - Organize your compliance projects
2. Upload Documents - Drag and drop your compliance files
3. Run AI Analysis - Get instant compliance insights
4. Invite Team Members - Collaborate on compliance management

GET STARTED: https://app.auditguardx.com/dashboard

Need help? Check out our documentation at https://docs.auditguardx.com or reply to this email.

What happens after the trial?
On ${trialEndDate}, you'll automatically move to our Free plan unless you upgrade. You'll keep all your data and can upgrade anytime.

---
© 2024 AuditGuardX. All rights reserved.
Unsubscribe: https://auditguardx.com/unsubscribe
      `,
    };
  }

  private renderTrialExpirationWarning(params: {
    userName: string;
    organizationName: string;
    daysRemaining: number;
    trialEndDate: string;
  }): EmailTemplate {
    const { userName, organizationName, daysRemaining, trialEndDate } = params;

    return {
      subject: `Your AuditGuard trial expires in ${daysRemaining} days`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Your free trial for <strong>${organizationName}</strong> is ending soon.</p>

              <div class="warning">
                <strong>⏰ ${daysRemaining} days remaining</strong><br>
                Your trial will expire on ${trialEndDate}
              </div>

              <p>To continue using AuditGuard's compliance management features, please upgrade to a paid plan.</p>

              <p><strong>What happens when the trial ends?</strong></p>
              <ul>
                <li>Your account will automatically downgrade to the Free plan</li>
                <li>You'll retain access to your documents and data</li>
                <li>Advanced features like AI analysis will be disabled</li>
              </ul>

              <a href="https://auditguard.com/billing" class="button">Upgrade Now</a>

              <p>Questions? Reply to this email and we'll be happy to help!</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
              <p>You're receiving this because you have an active trial with AuditGuard.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${userName},

Your free trial for ${organizationName} is ending soon.

⏰ ${daysRemaining} days remaining
Your trial will expire on ${trialEndDate}

To continue using AuditGuard's compliance management features, please upgrade to a paid plan.

What happens when the trial ends?
- Your account will automatically downgrade to the Free plan
- You'll retain access to your documents and data
- Advanced features like AI analysis will be disabled

Upgrade now: https://auditguard.com/billing

Questions? Reply to this email and we'll be happy to help!

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderTrialExpired(params: {
    userName: string;
    organizationName: string;
  }): EmailTemplate {
    const { userName, organizationName } = params;

    return {
      subject: 'Your AuditGuard trial has expired',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .info { background: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Your free trial for <strong>${organizationName}</strong> has ended.</p>

              <div class="info">
                <strong>📋 Your account is now on the Free plan</strong><br>
                Don't worry - your data is safe and accessible!
              </div>

              <p><strong>What you can still do:</strong></p>
              <ul>
                <li>View and download your documents</li>
                <li>Access basic compliance checks</li>
                <li>Manage your workspaces</li>
              </ul>

              <p><strong>Ready to unlock all features?</strong></p>
              <p>Upgrade to a paid plan to regain access to AI-powered analysis, advanced analytics, and more.</p>

              <a href="https://auditguard.com/billing" class="button">View Plans & Pricing</a>

              <p>Questions? We're here to help!</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${userName},

Your free trial for ${organizationName} has ended.

📋 Your account is now on the Free plan
Don't worry - your data is safe and accessible!

What you can still do:
- View and download your documents
- Access basic compliance checks
- Manage your workspaces

Ready to unlock all features?
Upgrade to a paid plan to regain access to AI-powered analysis, advanced analytics, and more.

View Plans & Pricing: https://auditguard.com/billing

Questions? We're here to help!

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderPaymentFailed(params: {
    userName: string;
    organizationName: string;
    amount: number;
    lastFourDigits: string;
    retryDate?: string;
  }): EmailTemplate {
    const { userName, organizationName, amount, lastFourDigits, retryDate } = params;
    const formattedAmount = `$${(amount / 100).toFixed(2)}`;

    return {
      subject: 'Payment failed for your AuditGuard subscription',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>

              <div class="alert">
                <strong>❌ Payment Failed</strong><br>
                We couldn't process your payment for ${organizationName}
              </div>

              <p><strong>Payment Details:</strong></p>
              <ul>
                <li>Amount: ${formattedAmount}</li>
                <li>Card ending in: ${lastFourDigits}</li>
                ${retryDate ? `<li>Next retry: ${retryDate}</li>` : ''}
              </ul>

              <p>This could be due to insufficient funds, an expired card, or other issues with your payment method.</p>

              <p><strong>What to do next:</strong></p>
              <ol>
                <li>Update your payment method in the billing settings</li>
                <li>Ensure your card has sufficient funds</li>
                <li>Contact your bank if the issue persists</li>
              </ol>

              <a href="https://auditguard.com/billing" class="button">Update Payment Method</a>

              <p>If you don't update your payment method, your subscription may be cancelled and you'll lose access to premium features.</p>

              <p>Need help? Contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${userName},

❌ Payment Failed
We couldn't process your payment for ${organizationName}

Payment Details:
- Amount: ${formattedAmount}
- Card ending in: ${lastFourDigits}
${retryDate ? `- Next retry: ${retryDate}` : ''}

This could be due to insufficient funds, an expired card, or other issues with your payment method.

What to do next:
1. Update your payment method in the billing settings
2. Ensure your card has sufficient funds
3. Contact your bank if the issue persists

Update Payment Method: https://auditguard.com/billing

If you don't update your payment method, your subscription may be cancelled and you'll lose access to premium features.

Need help? Contact our support team.

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderInvoiceReceipt(params: {
    userName: string;
    organizationName: string;
    amount: number;
    invoiceNumber: string;
    invoiceUrl: string;
    billingDate: string;
    planName: string;
  }): EmailTemplate {
    const { userName, organizationName, amount, invoiceNumber, invoiceUrl, billingDate, planName } = params;
    const formattedAmount = `$${(amount / 100).toFixed(2)}`;

    return {
      subject: `Invoice ${invoiceNumber} - Payment Received`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; }
            .invoice-details { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>

              <div class="success">
                <strong>✅ Payment Received</strong><br>
                Thank you for your payment!
              </div>

              <p>We've successfully processed your payment for <strong>${organizationName}</strong>.</p>

              <div class="invoice-details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                <p><strong>Date:</strong> ${billingDate}</p>
                <p><strong>Plan:</strong> ${planName}</p>
                <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
              </div>

              <a href="${invoiceUrl}" class="button">Download Invoice</a>

              <p>Your subscription is active and all features are available.</p>

              <p>Questions about your invoice? Contact our billing support team.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${userName},

✅ Payment Received
Thank you for your payment!

We've successfully processed your payment for ${organizationName}.

Invoice Details:
- Invoice Number: ${invoiceNumber}
- Date: ${billingDate}
- Plan: ${planName}
- Amount Paid: ${formattedAmount}

Download Invoice: ${invoiceUrl}

Your subscription is active and all features are available.

Questions about your invoice? Contact our billing support team.

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderWorkspaceInvitation(params: {
    inviterName: string;
    workspaceName: string;
    role: string;
    invitationLink: string;
  }): EmailTemplate {
    const { inviterName, workspaceName, role, invitationLink } = params;

    return {
      subject: `${inviterName} invited you to join ${workspaceName} on AuditGuard`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .info { background: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>You've been invited!</h2>

              <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on AuditGuard.</p>

              <div class="info">
                <strong>Your Role:</strong> ${role}<br>
                <strong>Workspace:</strong> ${workspaceName}
              </div>

              <p>AuditGuard helps teams manage compliance documents, track issues, and maintain regulatory requirements efficiently.</p>

              <a href="${invitationLink}" class="button">Accept Invitation</a>

              <p><small>This invitation link will expire in 7 days.</small></p>

              <p>Not interested? You can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `You've been invited!

${inviterName} has invited you to join ${workspaceName} on AuditGuard.

Your Role: ${role}
Workspace: ${workspaceName}

AuditGuard helps teams manage compliance documents, track issues, and maintain regulatory requirements efficiently.

Accept Invitation: ${invitationLink}

This invitation link will expire in 7 days.

Not interested? You can safely ignore this email.

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderIssueAssignment(params: {
    assigneeName: string;
    assignerName: string;
    issueTitle: string;
    workspaceName: string;
    severity: string;
    issueUrl: string;
  }): EmailTemplate {
    const { assigneeName, assignerName, issueTitle, workspaceName, severity, issueUrl } = params;

    return {
      subject: `New compliance issue assigned: ${issueTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .issue-details { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
            .severity-high { background: #fee2e2; color: #991b1b; }
            .severity-medium { background: #fed7aa; color: #9a3412; }
            .severity-low { background: #fef3c7; color: #854d0e; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${assigneeName},</h2>

              <p><strong>${assignerName}</strong> has assigned a compliance issue to you.</p>

              <div class="issue-details">
                <h3>${issueTitle}</h3>
                <p><strong>Workspace:</strong> ${workspaceName}</p>
                <p><strong>Severity:</strong> <span class="severity severity-${severity.toLowerCase()}">${severity}</span></p>
              </div>

              <a href="${issueUrl}" class="button">View Issue</a>

              <p>Please review and address this issue at your earliest convenience.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${assigneeName},

${assignerName} has assigned a compliance issue to you.

Issue: ${issueTitle}
Workspace: ${workspaceName}
Severity: ${severity}

View Issue: ${issueUrl}

Please review and address this issue at your earliest convenience.

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderDocumentProcessed(params: {
    userName: string;
    documentName: string;
    workspaceName: string;
    issuesFound: number;
    documentUrl: string;
  }): EmailTemplate {
    const { userName, documentName, workspaceName, issuesFound, documentUrl } = params;

    return {
      subject: `Document processed: ${documentName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>

              <div class="success">
                <strong>✅ Document Processed</strong><br>
                Your document has been analyzed successfully!
              </div>

              <p><strong>${documentName}</strong> in workspace <strong>${workspaceName}</strong> has been processed.</p>

              <p><strong>Analysis Results:</strong></p>
              <ul>
                <li>Compliance issues found: ${issuesFound}</li>
                <li>AI analysis: Complete</li>
                <li>Document indexed and searchable</li>
              </ul>

              <a href="${documentUrl}" class="button">View Document</a>

              ${issuesFound > 0 ? '<p><strong>Action Required:</strong> Please review the identified compliance issues.</p>' : ''}
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${userName},

✅ Document Processed
Your document has been analyzed successfully!

${documentName} in workspace ${workspaceName} has been processed.

Analysis Results:
- Compliance issues found: ${issuesFound}
- AI analysis: Complete
- Document indexed and searchable

View Document: ${documentUrl}

${issuesFound > 0 ? 'Action Required: Please review the identified compliance issues.' : ''}

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  private renderDocumentProcessingFailed(params: {
    userName: string;
    documentName: string;
    workspaceName: string;
    errorMessage: string;
  }): EmailTemplate {
    const { userName, documentName, workspaceName, errorMessage } = params;

    return {
      subject: `Document processing failed: ${documentName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AuditGuard</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>

              <div class="alert">
                <strong>❌ Processing Failed</strong><br>
                We encountered an issue processing your document
              </div>

              <p>The document <strong>${documentName}</strong> in workspace <strong>${workspaceName}</strong> could not be processed.</p>

              <p><strong>Error:</strong> ${errorMessage}</p>

              <p><strong>What to do next:</strong></p>
              <ol>
                <li>Check that the document format is supported (PDF, DOCX, TXT)</li>
                <li>Ensure the document is not corrupted or password-protected</li>
                <li>Try re-uploading the document</li>
                <li>Contact support if the issue persists</li>
              </ol>

              <a href="https://auditguard.com/support" class="button">Contact Support</a>
            </div>
            <div class="footer">
              <p>&copy; 2024 AuditGuard. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${userName},

❌ Processing Failed
We encountered an issue processing your document

The document ${documentName} in workspace ${workspaceName} could not be processed.

Error: ${errorMessage}

What to do next:
1. Check that the document format is supported (PDF, DOCX, TXT)
2. Ensure the document is not corrupted or password-protected
3. Try re-uploading the document
4. Contact support if the issue persists

Contact Support: https://auditguard.com/support

© 2024 AuditGuard. All rights reserved.`,
    };
  }

  /**
   * Strip HTML tags for text-only email version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
