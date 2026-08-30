// src/lib/services/webhook-security.service.ts
import crypto from 'crypto';

export class WebhookSecurity {
  private static instance: WebhookSecurity;

  static getInstance(): WebhookSecurity {
    if (!WebhookSecurity.instance) {
      WebhookSecurity.instance = new WebhookSecurity();
    }
    return WebhookSecurity.instance;
  }

  generateSignature(payload: any, secret: string): string {
    const timestamp = Date.now().toString();
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  verifySignature(
    payload: any,
    signature: string,
    timestamp: string,
    secret: string
  ): boolean {
    // Check timestamp (prevent replay attacks)
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

  generateWebhookId(): string {
    return `wh_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}