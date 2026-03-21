/**
 * Midtrans Payment Gateway Integration
 *
 * This service handles all interactions with the Midtrans payment gateway,
 * including creating payment transactions, verifying webhook signatures,
 * and processing payment notifications.
 *
 * Midtrans API Documentation: https://api-docs.midtrans.com/
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Transaction } from '@/services/escrow/types';
import { EscrowEngine } from '@/services/escrow/engine';
import { LedgerService } from '@/services/escrow/ledger';
import { verifyMidtransSignature } from '@/lib/crypto';
import { ConflictError, ValidationError } from '@/lib/errors';

/**
 * Midtrans notification payload structure
 */
export interface MidtransNotification {
  transaction_id: string;
  transaction_status: string;
  fraud_status?: string;
  order_id: string;
  gross_amount: string;
  status_code: string;
  payment_type?: string;
}

/**
 * Payment result from createPayment
 */
export interface PaymentResult {
  token: string;
  redirectUrl: string;
}

/**
 * Notification processing result
 */
export interface NotificationResult {
  transactionId: string;
  status: 'success' | 'failure' | 'pending';
}

/**
 * Midtrans service for payment gateway integration
 */
export class MidtransService {
  private readonly authHeader: string;

  /**
   * Constructor
   *
   * @param serverKey - Midtrans server key for API authentication
   * @param apiUrl - Midtrans API URL (sandbox or production)
   * @param db - Optional D1 database instance
   */
  constructor(
    private readonly serverKey: string,
    private readonly apiUrl: string,
    private readonly db?: D1Database
  ) {
    // Create Basic Auth header: base64(serverKey + ":")
    const authValue = btoa(`${serverKey}:`);
    this.authHeader = `Basic ${authValue}`;
  }

  /**
   * Get EscrowEngine instance
   */
  private getEscrowEngine(): EscrowEngine {
    if (!this.db) {
      throw new Error('Database instance required for EscrowEngine');
    }
    return new EscrowEngine(this.db);
  }

  /**
   * Get LedgerService instance
   */
  private getLedgerService(): LedgerService {
    if (!this.db) {
      throw new Error('Database instance required for LedgerService');
    }
    return new LedgerService(this.db);
  }

  /**
   * Create a payment transaction in Midtrans
   *
   * This initializes a payment session and returns a token and redirect URL
   * that the buyer can use to complete the payment.
   *
   * @param transaction - The transaction to create payment for
   * @returns Payment token and redirect URL
   * @throws Error if API request fails
   */
  async createPayment(transaction: Transaction): Promise<PaymentResult> {
    // Format order ID as escrow-{transaction_id}
    const orderId = `escrow-${transaction.id}`;

    // Build request payload according to Midtrans API spec
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: transaction.amount,
      },
      customer_details: {
        email: transaction.buyer_email,
        phone: transaction.buyer_phone,
      },
      // Store metadata in custom fields
      custom_field1: transaction.seller_id,
      custom_field2: transaction.id,
    };

    // Make API request to Midtrans SNAP API
    const response = await fetch(`${this.apiUrl}/v2/snap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Midtrans API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json() as {
      token?: string;
      redirect_url?: string;
    };

    // Validate response
    if (!data.token || !data.redirect_url) {
      throw new Error('Invalid Midtrans response: missing token or redirect_url');
    }

    return {
      token: data.token,
      redirectUrl: data.redirect_url,
    };
  }

  /**
   * Verify webhook signature from Midtrans
   *
   * Midtrans sends signature in header with format: SHA512(orderId + statusCode + grossAmount)
   *
   * @param signature - The signature from the webhook header
   * @param payload - The notification payload
   * @returns True if signature is valid, false otherwise
   */
  async verifyWebhook(
    signature: string,
    payload: {
      order_id: string;
      status_code: string;
      gross_amount: string;
    }
  ): Promise<boolean> {
    if (!signature || !payload) {
      return false;
    }

    try {
      return await verifyMidtransSignature(
        payload.order_id,
        payload.status_code,
        payload.gross_amount,
        signature,
        this.serverKey
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Process payment notification from Midtrans webhook
   *
   * This handles all payment status updates and updates the transaction
   * state and ledger accordingly.
   *
   * Transaction states in Midtrans:
   * - pending: Payment initiated but not completed
   * - capture: Payment successfully captured (credit card)
   * - settlement: Payment settled (bank transfer, e-wallet)
   * - deny: Payment denied/rejected
   * - expire: Payment expired
   * - cancel: Payment cancelled
   *
   * @param notification - The notification payload from Midtrans
   * @returns Processing result with transaction ID and status
   */
  async processNotification(
    notification: MidtransNotification
  ): Promise<NotificationResult> {
    if (!this.db) {
      throw new Error('Database instance required');
    }

    // Extract transaction ID from order_id (format: escrow-{transaction_id})
    const orderId = notification.order_id;
    if (!orderId.startsWith('escrow-')) {
      throw new ValidationError('Invalid order_id format');
    }

    const transactionId = orderId.replace('escrow-', '');
    const escrowEngine = this.getEscrowEngine();
    const ledgerService = this.getLedgerService();

    // Check current transaction status for idempotency
    const currentTransaction = await escrowEngine.getTransaction(transactionId);

    // Handle idempotency - if already processed, return success
    if (currentTransaction && currentTransaction.status === 'held') {
      console.log(`Transaction ${transactionId} already held, skipping duplicate notification`);
      return {
        transactionId,
        status: 'success',
      };
    }

    // Process based on transaction status
    const transactionStatus = notification.transaction_status;

    // Successful payment (capture or settlement)
    if (
      (transactionStatus === 'capture' || transactionStatus === 'settlement') &&
      notification.fraud_status !== 'challenge'
    ) {
      // Mark as funded
      await escrowEngine.markAsFunded(
        transactionId,
        notification.transaction_id
      );

      // Mark as held (immediate transition for MVP)
      await escrowEngine.markAsHeld(transactionId);

      // Record hold in ledger (funds held for transaction)
      await ledgerService.recordHold(
        transactionId,
        currentTransaction?.seller_id || '',
        currentTransaction?.net_amount || 0,
        {
          midtrans_transaction_id: notification.transaction_id,
          payment_type: notification.payment_type,
          gross_amount: notification.gross_amount,
        }
      );

      return {
        transactionId,
        status: 'success',
      };
    }

    // Failed payment
    if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
      // Transaction remains in pending state or could be marked as failed
      // For now, we just log the failure
      console.log(`Payment failed for transaction ${transactionId}: ${transactionStatus}`);

      return {
        transactionId,
        status: 'failure',
      };
    }

    // Pending payment
    if (transactionStatus === 'pending') {
      console.log(`Payment pending for transaction ${transactionId}`);

      return {
        transactionId,
        status: 'pending',
      };
    }

    // Challenge status (fraud detection)
    if (transactionStatus === 'challenge') {
      console.log(`Payment challenge for transaction ${transactionId}, manual review required`);

      return {
        transactionId,
        status: 'pending',
      };
    }

    // Unknown status
    console.warn(`Unknown transaction status: ${transactionStatus} for transaction ${transactionId}`);

    return {
      transactionId,
      status: 'pending',
    };
  }

  /**
   * Get payment status from Midtrans API
   *
   * This queries the Midtrans API for the current status of a transaction.
   * Useful for manual status checks or reconciliation.
   *
   * @param orderId - The order ID (format: escrow-{transaction_id})
   * @returns Transaction status from Midtrans
   * @throws Error if API request fails
   */
  async getStatus(orderId: string): Promise<any> {
    const response = await fetch(
      `${this.apiUrl}/v2/${orderId}/status`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Midtrans API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Create signature for testing purposes
   * This is a private method exposed for testing
   *
   * @internal
   */
  async createSignature(
    orderId: string,
    statusCode: string,
    grossAmount: string
  ): Promise<string> {
    const data = `${orderId}${statusCode}${grossAmount}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.serverKey);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = new Uint8Array(signature);
    const hashHex = Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return hashHex;
  }
}
