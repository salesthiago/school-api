import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentProviderKey } from '../../common/enums/payment-provider-key.enum';
import { PaymentMethod } from '../../orders/schemas/order.schema';

export type PaymentSettingsDocument = HydratedDocument<PaymentSettings>;

/** Um método de pagamento oferecido ao aluno + qual gateway o processa. */
@Schema({ _id: false })
export class PaymentMethodRoute {
  @Prop({ type: String, enum: PaymentMethod, required: true })
  method: PaymentMethod;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: String, enum: PaymentProviderKey, required: true })
  providerKey: PaymentProviderKey;
}
export const PaymentMethodRouteSchema =
  SchemaFactory.createForClass(PaymentMethodRoute);

/** Credenciais do Itaú (Pix / Pix recorrente). Campos *Enc guardam AES-256-GCM. */
@Schema({ _id: false })
export class ItauConfig {
  @Prop({ default: false })
  enabled: boolean;

  @Prop({
    type: String,
    enum: ['sandbox', 'production'],
    default: 'production',
  })
  environment: 'sandbox' | 'production';

  @Prop({ trim: true })
  clientId?: string;

  @Prop()
  clientSecretEnc?: string;

  @Prop()
  webhookSecretEnc?: string;

  @Prop()
  certificatePemEnc?: string;

  @Prop()
  privateKeyPemEnc?: string;

  /** id_beneficiario (Agência+00+Conta+DAC) usado no cadastro do webhook de cobrança. */
  @Prop({ trim: true })
  beneficiaryId?: string;

  @Prop({ default: false })
  recurringEnabled: boolean;
}
export const ItauConfigSchema = SchemaFactory.createForClass(ItauConfig);

/** Credenciais do Stripe (cartão) — integração futura; armazenável desde já. */
@Schema({ _id: false })
export class StripeConfig {
  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: String, enum: ['test', 'live'], default: 'test' })
  environment: 'test' | 'live';

  @Prop({ trim: true })
  publishableKey?: string;

  @Prop()
  secretKeyEnc?: string;

  @Prop()
  webhookSecretEnc?: string;
}
export const StripeConfigSchema = SchemaFactory.createForClass(StripeConfig);

@Schema({ timestamps: true })
export class PaymentSettings {
  @Prop({ type: [PaymentMethodRouteSchema], default: [] })
  methods: PaymentMethodRoute[];

  @Prop({ type: ItauConfigSchema, default: () => ({}) })
  itau: ItauConfig;

  @Prop({ type: StripeConfigSchema, default: () => ({}) })
  stripe: StripeConfig;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const PaymentSettingsSchema =
  SchemaFactory.createForClass(PaymentSettings);
