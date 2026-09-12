import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { readFileSync } from 'fs';
import { Model, Types } from 'mongoose';
import { PaymentProviderKey } from '../common/enums/payment-provider-key.enum';
import { decryptMaybe, encryptSecret } from '../common/utils/crypto.util';
import { PaymentMethod } from '../orders/schemas/order.schema';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { PaymentProviderConfig } from './providers/payment-provider.interface';
import { PaymentProviderRegistry } from './providers/provider-registry';
import {
  PaymentSettings,
  PaymentSettingsDocument,
} from './schemas/payment-settings.schema';

export interface ItauRuntimeConfig extends PaymentProviderConfig {
  environment: 'sandbox' | 'production';
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  certificatePem?: string;
  privateKeyPem?: string;
  beneficiaryId?: string;
  recurringEnabled: boolean;
}

export interface StripeRuntimeConfig extends PaymentProviderConfig {
  environment: 'test' | 'live';
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

const DEFAULT_METHOD_ROUTES = [
  {
    method: PaymentMethod.PIX,
    enabled: true,
    providerKey: PaymentProviderKey.ITAU,
  },
  {
    method: PaymentMethod.CREDIT_CARD,
    enabled: false,
    providerKey: PaymentProviderKey.STRIPE,
  },
  {
    method: PaymentMethod.DEBIT_CARD,
    enabled: false,
    providerKey: PaymentProviderKey.STRIPE,
  },
];

const PEM_CERT_RE =
  /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;
const PEM_KEY_RE =
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC )?PRIVATE KEY-----/;

@Injectable()
export class PaymentSettingsService {
  constructor(
    @InjectModel(PaymentSettings.name)
    private readonly model: Model<PaymentSettingsDocument>,
    private readonly config: ConfigService,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  // ---------------------------------------------------------------- doc lifecycle

  private async getOrCreateDefault(): Promise<PaymentSettingsDocument> {
    const existing = await this.model.findOne();
    if (existing) {
      if (!existing.methods || existing.methods.length === 0) {
        existing.methods = DEFAULT_METHOD_ROUTES;
        await existing.save();
      }
      return existing;
    }
    const envClientId = this.config.get<string>('ITAU_CLIENT_ID')?.trim();
    return this.model.create({
      methods: DEFAULT_METHOD_ROUTES,
      itau: {
        enabled: !!envClientId,
        environment: 'production',
        clientId: envClientId || undefined,
      },
      stripe: {},
    });
  }

  // ---------------------------------------------------------------- admin API view

  async getRedacted() {
    const doc = await this.getOrCreateDefault();
    return {
      methods: doc.methods.map((m) => ({
        method: m.method,
        enabled: m.enabled,
        providerKey: m.providerKey,
      })),
      itau: {
        enabled: doc.itau.enabled,
        environment: doc.itau.environment,
        clientId: doc.itau.clientId ?? null,
        beneficiaryId: doc.itau.beneficiaryId ?? null,
        recurringEnabled: doc.itau.recurringEnabled,
        clientSecretConfigured: !!doc.itau.clientSecretEnc,
        webhookSecretConfigured: !!doc.itau.webhookSecretEnc,
        certificateConfigured: !!doc.itau.certificatePemEnc,
        privateKeyConfigured: !!doc.itau.privateKeyPemEnc,
      },
      stripe: {
        enabled: doc.stripe.enabled,
        environment: doc.stripe.environment,
        publishableKey: doc.stripe.publishableKey ?? null,
        secretKeyConfigured: !!doc.stripe.secretKeyEnc,
        webhookSecretConfigured: !!doc.stripe.webhookSecretEnc,
      },
      providers: this.registry.list().map((p) => ({
        key: p.key,
        supportedMethods: p.supportedMethods,
        supportsRecurring: p.supportsRecurring,
      })),
      updatedAt: (doc as unknown as { updatedAt?: Date }).updatedAt ?? null,
    };
  }

  // ---------------------------------------------------------------- update

  async update(dto: UpdatePaymentSettingsDto, userId: string) {
    const doc = await this.getOrCreateDefault();

    if (dto.methods) {
      for (const route of dto.methods) {
        const provider = this.registry.has(route.providerKey)
          ? this.registry.get(route.providerKey)
          : null;
        if (!provider) {
          throw new BadRequestException(
            `Provedor desconhecido: ${route.providerKey}`,
          );
        }
        if (
          route.enabled &&
          !provider.supportedMethods.includes(route.method)
        ) {
          throw new BadRequestException(
            `O provedor ${route.providerKey} não processa o método ${route.method}.`,
          );
        }
      }
      // dedup por método (último vence), mantém ordem de chegada
      const byMethod = new Map<PaymentMethod, (typeof dto.methods)[number]>();
      for (const route of dto.methods) byMethod.set(route.method, route);
      doc.methods = [...byMethod.values()].map((r) => ({
        method: r.method,
        enabled: r.enabled,
        providerKey: r.providerKey,
      }));
    }

    if (dto.itau) {
      const c = dto.itau;
      if (c.enabled !== undefined) doc.itau.enabled = c.enabled;
      if (c.environment !== undefined) doc.itau.environment = c.environment;
      if (c.clientId !== undefined)
        doc.itau.clientId = c.clientId.trim() || undefined;
      if (c.beneficiaryId !== undefined)
        doc.itau.beneficiaryId = c.beneficiaryId.trim() || undefined;
      if (c.recurringEnabled !== undefined)
        doc.itau.recurringEnabled = c.recurringEnabled;
      if (c.clientSecret)
        doc.itau.clientSecretEnc = encryptSecret(c.clientSecret);
      if (c.webhookSecret)
        doc.itau.webhookSecretEnc = encryptSecret(c.webhookSecret);
    }

    if (dto.stripe) {
      const c = dto.stripe;
      if (c.enabled !== undefined) doc.stripe.enabled = c.enabled;
      if (c.environment !== undefined) doc.stripe.environment = c.environment;
      if (c.publishableKey !== undefined) {
        doc.stripe.publishableKey = c.publishableKey.trim() || undefined;
      }
      if (c.secretKey) doc.stripe.secretKeyEnc = encryptSecret(c.secretKey);
      if (c.webhookSecret)
        doc.stripe.webhookSecretEnc = encryptSecret(c.webhookSecret);
    }

    doc.updatedBy = new Types.ObjectId(userId);
    await doc.save();
    return this.getRedacted();
  }

  async uploadItauCertificate(file: Express.Multer.File) {
    const pem = this.readPem(file, PEM_CERT_RE, 'certificado (.crt)');
    const doc = await this.getOrCreateDefault();
    doc.itau.certificatePemEnc = encryptSecret(pem);
    await doc.save();
    return this.getRedacted();
  }

  async uploadItauPrivateKey(file: Express.Multer.File) {
    const pem = this.readPem(file, PEM_KEY_RE, 'chave privada (.key)');
    const doc = await this.getOrCreateDefault();
    doc.itau.privateKeyPemEnc = encryptSecret(pem);
    await doc.save();
    return this.getRedacted();
  }

  private readPem(
    file: Express.Multer.File | undefined,
    re: RegExp,
    label: string,
  ): string {
    if (!file?.buffer?.length) {
      throw new BadRequestException(`Arquivo de ${label} não enviado.`);
    }
    const text = file.buffer.toString('utf8');
    if (!re.test(text)) {
      throw new BadRequestException(
        `O arquivo enviado não parece ser um ${label} PEM válido.`,
      );
    }
    return text.trim() + '\n';
  }

  // ---------------------------------------------------------------- runtime config

  async getItauConfig(): Promise<ItauRuntimeConfig> {
    const doc = await this.getOrCreateDefault();
    const i = doc.itau;
    return {
      environment: i.environment,
      clientId:
        i.clientId ?? this.config.get<string>('ITAU_CLIENT_ID') ?? undefined,
      clientSecret:
        decryptMaybe(i.clientSecretEnc) ??
        this.config.get<string>('ITAU_CLIENT_SECRET') ??
        undefined,
      webhookSecret:
        decryptMaybe(i.webhookSecretEnc) ??
        this.config.get<string>('ITAU_WEBHOOK_SECRET') ??
        undefined,
      certificatePem:
        decryptMaybe(i.certificatePemEnc) ??
        this.readFileMaybe(this.config.get<string>('ITAU_CERTIFICATE_PATH')),
      privateKeyPem:
        decryptMaybe(i.privateKeyPemEnc) ??
        this.readFileMaybe(this.config.get<string>('ITAU_PRIVATE_KEY_PATH')),
      beneficiaryId: i.beneficiaryId ?? undefined,
      recurringEnabled: i.recurringEnabled,
    };
  }

  async getStripeConfig(): Promise<StripeRuntimeConfig> {
    const doc = await this.getOrCreateDefault();
    const s = doc.stripe;
    return {
      environment: s.environment,
      publishableKey: s.publishableKey ?? undefined,
      secretKey:
        decryptMaybe(s.secretKeyEnc) ??
        this.config.get<string>('STRIPE_SECRET_KEY'),
      webhookSecret:
        decryptMaybe(s.webhookSecretEnc) ??
        this.config.get<string>('STRIPE_WEBHOOK_SECRET'),
    };
  }

  async getConfigFor(key: PaymentProviderKey): Promise<PaymentProviderConfig> {
    switch (key) {
      case PaymentProviderKey.ITAU:
        return this.getItauConfig();
      case PaymentProviderKey.STRIPE:
        return this.getStripeConfig();
      default:
        return {};
    }
  }

  /**
   * Resolve o provedor responsável por um método habilitado.
   * Lança BadRequest se o método está desabilitado, sem rota, ou o provedor não está configurado.
   */
  async resolveForMethod(method: PaymentMethod): Promise<{
    providerKey: PaymentProviderKey;
    config: PaymentProviderConfig;
    recurring: boolean;
  }> {
    const doc = await this.getOrCreateDefault();
    const route = doc.methods.find((m) => m.method === method);
    if (!route || !route.enabled) {
      throw new BadRequestException(
        `Método de pagamento "${method}" não está habilitado.`,
      );
    }
    const provider = this.registry.get(route.providerKey);
    const config = await this.getConfigFor(route.providerKey);
    if (!provider.isConfigured(config)) {
      throw new BadRequestException(
        `O provedor ${route.providerKey} está selecionado para ${method}, mas não está configurado.`,
      );
    }
    const recurring =
      route.providerKey === PaymentProviderKey.ITAU &&
      doc.itau.recurringEnabled &&
      method === PaymentMethod.PIX;
    return { providerKey: route.providerKey, config, recurring };
  }

  private readFileMaybe(path?: string): string | undefined {
    if (!path) return undefined;
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return undefined;
    }
  }
}
