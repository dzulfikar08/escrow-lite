import { EscrowEngine } from './engine';
import type { Transaction } from './types';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';

/**
 * Confirmation token record from database
 */
export interface ConfirmationToken {
  id: string;
  transaction_id: string;
  token: string;
  buyer_email: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

/**
 * Configuration for confirmation tokens
 */
const TOKEN_CONFIG = {
  /**
   * Token expiry time in minutes (15 minutes)
   */
  TOKEN_EXPIRY_MINUTES: 15,

  /**
   * Base URL for confirmation links (fallback for local dev)
   * In production, this should come from environment variable
   */
  BASE_URL: process.env.PUBLIC_URL || 'http://localhost:4321',
} as const;

/**
 * Email message interface
 */
interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Confirmation Service - Handles buyer confirmation flow
 *
 * Manages single-use tokens for buyer email confirmation,
 * email notifications, and confirmation link generation.
 */
export class ConfirmationService {
  constructor(
    private db: D1Database,
    private engine: EscrowEngine
  ) {}

  /**
   * Generate a single-use confirmation token for a transaction
   *
   * Creates a SHA-256 hashed token that expires in 15 minutes.
   * The token is stored in the database with the transaction ID.
   *
   * @param transactionId - Transaction ID to confirm
   * @param buyerEmail - Buyer's email address
   * @returns Generated token (64-character hex string)
   * @throws Error if database operation fails
   */
  async generateToken(transactionId: string, buyerEmail: string): Promise<string> {
    // Generate unique token using crypto.randomUUID + SHA-256
    const rawToken = `${transactionId}-${crypto.randomUUID()}-${Date.now()}`;
    const tokenBuffer = new TextEncoder().encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    const token = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Calculate expiry time (15 minutes from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_CONFIG.TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Store token in database
    const id = `ct_${crypto.randomUUID()}`;
    const createdAt = now.toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO confirmation_tokens (id, transaction_id, token, buyer_email, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt
      .bind(id, transactionId, token, buyerEmail, expiresAt.toISOString(), createdAt)
      .run();

    return token;
  }

  /**
   * Generate a confirmation link for the buyer
   *
   * Combines token generation with URL construction to create
   * a clickable confirmation link for email delivery.
   *
   * @param transactionId - Transaction ID to confirm
   * @param buyerEmail - Buyer's email address
   * @returns Full confirmation URL
   */
  async generateConfirmationLink(transactionId: string, buyerEmail: string): Promise<string> {
    const token = await this.generateToken(transactionId, buyerEmail);
    const baseUrl = TOKEN_CONFIG.BASE_URL;
    return `${baseUrl}/api/v1/transactions/${transactionId}/confirm?token=${token}`;
  }

  /**
   * Validate a confirmation token
   *
   * Checks if token exists, is not expired, and has not been used.
   *
   * @param token - Token to validate
   * @returns Token record if valid, null otherwise
   */
  async validateToken(token: string): Promise<ConfirmationToken | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM confirmation_tokens
      WHERE token = ?
    `);

    const result = await stmt.bind(token).first();

    if (!result) {
      return null;
    }

    return {
      id: result.id as string,
      transaction_id: result.transaction_id as string,
      token: result.token as string,
      buyer_email: result.buyer_email as string,
      expires_at: result.expires_at as string,
      used_at: result.used_at as string | null,
      created_at: result.created_at as string,
    };
  }

  /**
   * Confirm buyer receipt and release funds
   *
   * Validates the token, checks transaction status, and releases funds.
   * Marks token as used to prevent reuse.
   *
   * @param token - Confirmation token from email link
   * @returns Updated transaction
   * @throws ValidationError if token is invalid or expired
   * @throws ConflictError if token already used or transaction not in HELD status
   * @throws NotFoundError if transaction not found
   */
  async confirmReceipt(token: string): Promise<Transaction> {
    // Validate token exists
    const tokenRecord = await this.validateToken(token);

    if (!tokenRecord) {
      throw new ValidationError('Invalid confirmation token');
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);

    if (expiresAt < now) {
      throw new ValidationError('Confirmation token has expired');
    }

    // Check if token already used
    if (tokenRecord.used_at) {
      throw new ConflictError('Confirmation token has already been used');
    }

    // Get transaction to verify status
    const transaction = await this.engine.getTransaction(tokenRecord.transaction_id);

    if (!transaction) {
      throw new NotFoundError(`Transaction ${tokenRecord.transaction_id} not found`);
    }

    // Verify transaction is in HELD status
    if (transaction.status !== 'held') {
      throw new ConflictError(
        `Cannot confirm transaction. Current status: ${transaction.status}`
      );
    }

    // Mark token as used
    const usedAt = now.toISOString();
    const updateTokenStmt = this.db.prepare(`
      UPDATE confirmation_tokens
      SET used_at = ?
      WHERE token = ?
    `);

    await updateTokenStmt.bind(usedAt, token).run();

    // Release funds to seller
    const updatedTransaction = await this.engine.buyerConfirm(tokenRecord.transaction_id);

    return updatedTransaction;
  }

  /**
   * Send confirmation email to buyer
   *
   * Generates confirmation link and sends email with instructions.
   * Uses Cloudflare Email Workers (placeholder for MVP).
   *
   * @param transactionId - Transaction ID to confirm
   * @param buyerEmail - Buyer's email address
   * @throws Error if email sending fails
   */
  async sendConfirmationEmail(
    transactionId: string,
    buyerEmail: string
  ): Promise<void> {
    // Generate confirmation link
    const link = await this.generateConfirmationLink(transactionId, buyerEmail);

    // Prepare email message
    const message: EmailMessage = {
      to: buyerEmail,
      subject: `Confirm Receipt for Order #${transactionId}`,
      html: this.getEmailHtml(transactionId, link),
      text: this.getEmailText(transactionId, link),
    };

    // Send email (placeholder for Cloudflare Email Workers)
    // In production, this would integrate with Cloudflare Email Workers
    // For now, we'll log to console for development
    try {
      // TODO: Integrate with Cloudflare Email Workers
      // await sendEmail(message);

      // Development fallback: log to console
      console.log('[ConfirmationService] Email would be sent:', {
        to: message.to,
        subject: message.subject,
        link: link,
      });
    } catch (error) {
      console.error('[ConfirmationService] Failed to send email:', error);
      throw new Error(`Failed to send confirmation email: ${error}`);
    }
  }

  /**
   * Check for transactions that have timed out
   *
   * Delegates to EscrowEngine.checkTimeouts() for the actual logic.
   * This method is called by the cron job handler.
   *
   * @returns Object with count of released transactions and any errors
   */
  async checkTimeouts(): Promise<{ released: number; errors: string[] }> {
    return this.engine.checkTimeouts();
  }

  /**
   * Generate HTML email body
   *
   * @param transactionId - Transaction ID
   * @param link - Confirmation link
   * @returns HTML email content
   */
  private getEmailHtml(transactionId: string, link: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; }
    .button:hover { background-color: #0056b3; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Confirm Receipt for Order #${transactionId}</h2>

    <p>Your order has been shipped! Please confirm you've received the items by clicking the button below:</p>

    <p><a href="${link}" class="button">Confirm Receipt</a></p>

    <p><strong>Important:</strong></p>
    <ul>
      <li>This link expires in 15 minutes for security</li>
      <li>If you did not receive your order, you can wait for auto-release (3 days from shipping date)</li>
      <li>If you have issues with your order, please contact the seller or open a dispute</li>
    </ul>

    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #007bff;">${link}</p>

    <div class="footer">
      <p>This is an automated message from Escrow Lite. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email body
   *
   * @param transactionId - Transaction ID
   * @param link - Confirmation link
   * @returns Plain text email content
   */
  private getEmailText(transactionId: string, link: string): string {
    return `
Confirm Receipt for Order #${transactionId}

Your order has been shipped! Please confirm you've received the items by clicking the link below:

${link}

Important:
- This link expires in 15 minutes for security
- If you did not receive your order, you can wait for auto-release (3 days from shipping date)
- If you have issues with your order, please contact the seller or open a dispute

This is an automated message from Escrow Lite. Please do not reply to this email.
    `.trim();
  }
}
