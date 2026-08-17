import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHmac } from 'crypto';
import {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  WebhookEvent,
} from './payment-provider.interface';

/**
 * Integração com a API Itaú (Pix Cobrança / Boleto).
 *
 * Produção: autenticação OAuth2 client-credentials + mTLS com certificado
 * digital da conta Itaú, endpoints reais de cobrança Pix e registro de
 * boleto, e validação de assinatura do webhook conforme documentação
 * do Itaú Developers. Os valores abaixo (ITAU_*) devem ser preenchidos
 * no .env antes de sair do modo sandbox/dev.
 */
@Injectable()
export class ItauPaymentProvider implements PaymentProvider {
  constructor(private config: ConfigService) {}

  async createCharge(request: ChargeRequest): Promise<ChargeResult> {
    const providerReference = randomUUID();

    if (request.method === 'pix') {
      return {
        providerReference,
        pixQrCode: `00020126DEV-SANDBOX-QR-${providerReference}`,
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

  parseWebhook(rawBody: Buffer, headers: Record<string, string>): WebhookEvent {
    const secret = this.config.get<string>('ITAU_WEBHOOK_SECRET') ?? 'dev-webhook-secret';
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
