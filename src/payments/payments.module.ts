import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  PaymentSettings,
  PaymentSettingsSchema,
} from './schemas/payment-settings.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentSettingsController } from './payment-settings.controller';
import { PAYMENT_PROVIDERS } from './providers/payment-provider.interface';
import { PaymentProviderRegistry } from './providers/provider-registry';
import { ItauPaymentProvider } from './providers/itau-payment.provider';
import { OrdersModule } from '../orders/orders.module';
import { ModulesModule } from '../modules/modules.module';
import { CoursesModule } from '../courses/courses.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentSettings.name, schema: PaymentSettingsSchema },
    ]),
    OrdersModule,
    ModulesModule,
    CoursesModule,
    EnrollmentsModule,
    AuditModule,
  ],
  controllers: [PaymentsController, PaymentSettingsController],
  providers: [
    PaymentsService,
    PaymentSettingsService,
    ItauPaymentProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (itau: ItauPaymentProvider) => [itau],
      inject: [ItauPaymentProvider],
    },
    PaymentProviderRegistry,
  ],
  exports: [PaymentsService, PaymentSettingsService],
})
export class PaymentsModule {}
