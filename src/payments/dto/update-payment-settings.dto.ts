import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentProviderKey } from '../../common/enums/payment-provider-key.enum';
import { PaymentMethod } from '../../orders/schemas/order.schema';

export class PaymentMethodRouteDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsBoolean()
  enabled: boolean;

  @IsEnum(PaymentProviderKey)
  providerKey: PaymentProviderKey;
}

export class ItauConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['sandbox', 'production'])
  environment?: 'sandbox' | 'production';

  @IsOptional()
  @IsString()
  clientId?: string;

  /** Vazio = manter o atual. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  clientSecret?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsOptional()
  @IsBoolean()
  recurringEnabled?: boolean;
}

export class StripeConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['test', 'live'])
  environment?: 'test' | 'live';

  @IsOptional()
  @IsString()
  publishableKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  secretKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  webhookSecret?: string;
}

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodRouteDto)
  methods?: PaymentMethodRouteDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ItauConfigDto)
  itau?: ItauConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StripeConfigDto)
  stripe?: StripeConfigDto;
}
