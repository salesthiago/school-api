import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProviderKey } from '../../common/enums/payment-provider-key.enum';
import { PaymentMethod } from '../../orders/schemas/order.schema';
import {
  PAYMENT_PROVIDERS,
  PaymentProvider,
} from './payment-provider.interface';

@Injectable()
export class PaymentProviderRegistry {
  private readonly byKey = new Map<PaymentProviderKey, PaymentProvider>();

  constructor(@Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[]) {
    for (const provider of providers) {
      this.byKey.set(provider.key, provider);
    }
  }

  get(key: PaymentProviderKey): PaymentProvider {
    const provider = this.byKey.get(key);
    if (!provider) {
      throw new NotFoundException(
        `Provedor de pagamento não registrado: ${key}`,
      );
    }
    return provider;
  }

  has(key: PaymentProviderKey): boolean {
    return this.byKey.has(key);
  }

  list(): PaymentProvider[] {
    return [...this.byKey.values()];
  }

  /** Provedores registrados que conseguem processar o método informado. */
  supporting(method: PaymentMethod): PaymentProvider[] {
    return this.list().filter((p) => p.supportedMethods.includes(method));
  }
}
