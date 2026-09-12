import { PaymentProviderKey } from '../../common/enums/payment-provider-key.enum';
import { PaymentMethod } from '../../orders/schemas/order.schema';

export interface ChargeRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  payer: { name: string; email: string };
  /** Cobrança recorrente (ex.: Pix recorrente do Itaú). */
  recurring?: boolean;
}

export interface ChargeResult {
  providerReference: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  /** Fluxos client-side (ex.: Stripe PaymentIntent) — segredo para o front confirmar o pagamento. */
  clientSecret?: string;
  /** Fluxos redirect/hosted-checkout — URL para onde enviar o pagador. */
  redirectUrl?: string;
  expiresAt?: Date;
}

export interface WebhookEvent {
  providerReference: string;
  status: 'paid' | 'expired' | 'canceled';
  raw: unknown;
}

/**
 * Configuração já descriptografada de um gateway, montada pelo
 * PaymentSettingsService a partir do documento salvo (com fallback para .env).
 * O shape concreto varia por provedor — cada implementação faz o cast.
 */
export type PaymentProviderConfig = Record<string, unknown>;

export interface PaymentProvider {
  /** Identificador único do gateway; usado no roteamento método→provedor e na URL do webhook. */
  readonly key: PaymentProviderKey;
  /** Métodos que este gateway consegue processar. */
  readonly supportedMethods: PaymentMethod[];
  /** Se o gateway suporta cobrança recorrente. */
  readonly supportsRecurring: boolean;

  /** true quando a config tem o mínimo necessário para operar. */
  isConfigured(config: PaymentProviderConfig): boolean;

  createCharge(
    request: ChargeRequest,
    config: PaymentProviderConfig,
  ): Promise<ChargeResult>;

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
    config: PaymentProviderConfig,
  ): WebhookEvent;
}

/** Token multi-inject: todas as implementações de PaymentProvider registradas no módulo. */
export const PAYMENT_PROVIDERS = 'PAYMENT_PROVIDERS';
