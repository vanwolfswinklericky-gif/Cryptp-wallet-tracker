// src/lib/webhooks/webhook-security.service.ts
import crypto from 'crypto';

export class WebhookSecurity {
  private static instance: WebhookSecurity;

  static getInstance(): WebhookSecurity {
    if (!WebhookSecurity.instance) {
      WebhookSecurity.instance = new WebhookSecurity();
    }
    return WebhookSecurity.instance;
  }

  /**
   * Generate HMAC-SHA256 signature - SECURE WEBHOOKS
   */
  generateSignature(payload: any, secret: string): string {
    const timestamp = Date.now().toString();
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify webhook signature - PREVENT FORGERY
   */
  verifySignature(
    payload: any,
    signature: string,
    timestamp: string,
    secret: string
  ): boolean {
    // Prevent replay attacks
    const age = Date.now() - parseInt(timestamp);
    if (age > 300000) { // 5 minutes
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate webhook ID - UNIQUE IDENTIFIER
   */
  generateWebhookId(): string {
    return `wh_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate webhook secret - SECURE RANDOM
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}