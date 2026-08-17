export interface ChargeRequest {
  orderId: string;
  amount: number;
  method: 'pix' | 'boleto';
  payer: { name: string; email: string };
}

export interface ChargeResult {
  providerReference: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  expiresAt?: Date;
}

export interface WebhookEvent {
  providerReference: string;
  status: 'paid' | 'expired' | 'canceled';
  raw: unknown;
}

export interface PaymentProvider {
  createCharge(request: ChargeRequest): Promise<ChargeResult>;
  parseWebhook(rawBody: Buffer, headers: Record<string, string>): WebhookEvent;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
