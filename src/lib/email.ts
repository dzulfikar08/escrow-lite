/**
 * Email utilities for Escrow Lite
 *
 * This module provides email sending functionality using Cloudflare Email Workers.
 * For MVP, this is a placeholder that logs to console.
 *
 * TODO: Integrate with Cloudflare Email Workers for production
 */

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
  type?: string; // MIME type
}

/**
 * Email message interface
 */
export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  from?: string;
  replyTo?: string;
}

/**
 * Email sending result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Configuration for email sending
 */
const EMAIL_CONFIG = {
  /**
   * Default sender email address
   * In production, this should come from environment variable
   */
  FROM_EMAIL: process.env.EMAIL_FROM || 'noreply@escrow-lite.example.com',

  /**
   * Default sender name
   */
  FROM_NAME: process.env.EMAIL_FROM_NAME || 'Escrow Lite',

  /**
   * Reply-to email address
   */
  REPLY_TO: process.env.EMAIL_REPLY_TO || 'support@escrow-lite.example.com',
} as const;

/**
 * Send an email using Cloudflare Email Workers
 *
 * This is a placeholder implementation for MVP.
 * In production, this would integrate with Cloudflare Email Workers API.
 *
 * @param message - Email message to send
 * @returns Promise with sending result
 *
 * @example
 * ```typescript
 * const result = await sendEmail({
 *   to: 'buyer@example.com',
 *   subject: 'Confirm Receipt',
 *   html: '<p>Click to confirm</p>',
 * });
 * ```
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  try {
    // Validate required fields
    if (!message.to) {
      throw new Error('Email "to" field is required');
    }

    if (!message.subject) {
      throw new Error('Email "subject" field is required');
    }

    if (!message.html && !message.text) {
      throw new Error('Email must have either "html" or "text" content');
    }

    // TODO: Integrate with Cloudflare Email Workers
    // For now, this is a placeholder that logs to console
    //
    // Production implementation would look like:
    // const response = await fetch('https://api.cloudflare.com/client/v4/email/workers', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
    //     to: message.to,
    //     subject: message.subject,
    //     html: message.html,
    //     text: message.text,
    //   }),
    // });

    // Development fallback: log to console
    console.log('[Email Service] Email would be sent:', {
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: message.to,
      subject: message.subject,
      hasHtml: !!message.html,
      hasText: !!message.text,
    });

    // Simulate successful send
    return {
      success: true,
      messageId: `msg_${crypto.randomUUID()}`,
    };
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a transactional email
 *
 * Helper function for sending common transactional emails.
 *
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param template - Template function that generates HTML content
 * @param data - Data to pass to template function
 * @returns Promise with sending result
 *
 * @example
 * ```typescript
 * const result = await sendTransactionalEmail(
 *   'buyer@example.com',
 *   'Confirm Receipt',
 *   (data) => `<h1>Confirm Order ${data.transactionId}</h1>`,
 *   { transactionId: 'tx_123' }
 * );
 * ```
 */
export async function sendTransactionalEmail<T = Record<string, unknown>>(
  to: string,
  subject: string,
  template: (data: T) => string,
  data: T
): Promise<EmailResult> {
  const html = template(data);

  return sendEmail({
    to,
    subject,
    html,
    text: stripHtmlTags(html),
  });
}

/**
 * Send bulk emails
 *
 * Send the same email to multiple recipients.
 * Useful for announcements or notifications.
 *
 * @param recipients - Array of email addresses
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content (optional)
 * @returns Array of sending results
 *
 * @example
 * ```typescript
 * const results = await sendBulkEmail(
 *   ['user1@example.com', 'user2@example.com'],
 *   'System Maintenance',
 *   '<p>System will be down for maintenance</p>'
 * );
 * ```
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  text?: string
): Promise<EmailResult[]> {
  const promises = recipients.map(recipient =>
    sendEmail({
      to: recipient,
      subject,
      html,
      text,
    })
  );

  return Promise.all(promises);
}

/**
 * Validate email address format
 *
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Strip HTML tags from string
 *
 * @param html - HTML string
 * @returns Plain text string
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Email template helper
 *
 * Provides common email template structure.
 */
export const emailTemplate = {
  /**
   * Generate base HTML email template
   */
  base: (content: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #007bff; }
    .content { padding: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; }
    .button:hover { background-color: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Escrow Lite</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated message from Escrow Lite. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Escrow Lite. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim(),

  /**
   * Generate button HTML
   */
  button: (text: string, url: string): string =>
    `<a href="${url}" class="button" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">${text}</a>`,

  /**
   * Generate alert HTML
   */
  alert: (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): string => {
    const colors = {
      info: '#d1ecf1',
      warning: '#fff3cd',
      error: '#f8d7da',
      success: '#d4edda',
    };

    return `<div style="padding: 15px; margin: 20px 0; background-color: ${colors[type]}; border-left: 4px solid #007bff; border-radius: 4px;">${message}</div>`;
  },
};
