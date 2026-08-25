import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { ItauPaymentProvider } from './providers/itau-payment.provider';
import { OrdersModule } from '../orders/orders.module';
import { ModulesModule } from '../modules/modules.module';
import { CoursesModule } from '../courses/courses.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    OrdersModule,
    ModulesModule,
    CoursesModule,
    EnrollmentsModule,
    AuditModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    ItauPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: ItauPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
