import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { PaymentProviderKey } from '../../common/enums/payment-provider-key.enum';
import { PaymentMethod } from '../../orders/schemas/order.schema';
import { ItauRuntimeConfig } from '../payment-settings.service';
import {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  PaymentProviderConfig,
  WebhookEvent,
} from './payment-provider.interface';

/**
 * Integração com a API Itaú (Pix Cobrança / Pix recorrente).
 *
 * As credenciais (client_id, client_secret, certificado + chave mTLS, webhook
 * secret, ambiente) vêm do PaymentSettingsService — configuráveis no painel
 * admin, com fallback para as variáveis ITAU_* do .env.
 *
 * As chamadas HTTP reais (OAuth2 client-credentials + mTLS, endpoints de
 * cobrança Pix, validação de assinatura do webhook) ainda estão em modo
 * sandbox/stub — a fiação da API real do Itaú é uma tarefa separada.
 */
@Injectable()
export class ItauPaymentProvider implements PaymentProvider {
  readonly key = PaymentProviderKey.ITAU;
  readonly supportedMethods: PaymentMethod[] = [PaymentMethod.PIX];
  readonly supportsRecurring = true;

  isConfigured(config: PaymentProviderConfig): boolean {
    const c = config as ItauRuntimeConfig;
    return !!(
      c.clientId &&
      c.clientSecret &&
      c.certificatePem &&
      c.privateKeyPem
    );
  }

  async createCharge(
    request: ChargeRequest,
    _config: PaymentProviderConfig,
  ): Promise<ChargeResult> {
    void _config;
    const providerReference = randomUUID();

    if (request.method === PaymentMethod.PIX) {
      const prefix = request.recurring
        ? 'DEV-SANDBOX-QR-REC'
        : 'DEV-SANDBOX-QR';
      return {
        providerReference,
        pixQrCode: `00020126${prefix}-${providerReference}`,
        pixCopyPaste: `dev-sandbox-pix-copy-paste-${providerReference}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }

    return {
      providerReference,
      boletoUrl: `https://sandbox.itau.example/boletos/${providerReference}`,
      boletoBarcode: `00190000090${providerReference.replace(/-/g, '').slice(0, 30)}`,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    };
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
    config: PaymentProviderConfig,
  ): WebhookEvent {
    const secret =
      (config as ItauRuntimeConfig).webhookSecret ?? 'dev-webhook-secret';
    const signature = headers['x-itau-signature'];
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    if (signature !== expected) {
      throw new Error('Assinatura de webhook inválida');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    return {
      providerReference: payload.providerReference,
      status: payload.status,
      raw: payload,
    };
  }
}
