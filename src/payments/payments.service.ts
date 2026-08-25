import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { CheckoutDto } from './dto/checkout.dto';
import { PAYMENT_PROVIDER, PaymentProvider } from './providers/payment-provider.interface';
import { OrdersService } from '../orders/orders.service';
import { ModulesService } from '../modules/modules.service';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
    private ordersService: OrdersService,
    private modulesService: ModulesService,
    private coursesService: CoursesService,
    private enrollmentsService: EnrollmentsService,
    private auditService: AuditService,
  ) {}

  async checkout(dto: CheckoutDto, student: JwtUser) {
    let moduleId: string | undefined;
    let courseId: string;
    let amount: number;

    if (dto.moduleId) {
      const courseModule = await this.modulesService.findById(dto.moduleId);
      if (courseModule.free || courseModule.price === 0) {
        throw new BadRequestException('Módulo gratuito não requer pagamento');
      }
      moduleId = dto.moduleId;
      courseId = courseModule.courseId.toString();
      amount = courseModule.price;
    } else {
      if (!dto.courseId) {
        throw new BadRequestException('Informe moduleId ou courseId');
      }
      const course = await this.coursesService.findById(dto.courseId);
      if (course.free || !course.bundlePrice) {
        throw new BadRequestException('Trilha de aulas gratuita não requer pagamento');
      }
      courseId = dto.courseId;
      amount = course.bundlePrice;
    }

    const order = await this.ordersService.create({
      studentId: student.userId,
      moduleId,
      courseId,
      amount,
      paymentMethod: dto.paymentMethod,
    });

    const charge = await this.provider.createCharge({
      orderId: order.id,
      amount,
      method: dto.paymentMethod,
      payer: { name: student.email, email: student.email },
    });

    const payment = await this.paymentModel.create({
      orderId: order.id,
      provider: 'itau',
      providerReference: charge.providerReference,
      status: PaymentStatus.PENDING,
      instructions: charge as unknown as Record<string, unknown>,
    });

    return { order, payment: { id: payment.id, ...charge } };
  }

  async handleWebhook(rawBody: Buffer, headers: Record<string, string>) {
    const event = this.provider.parseWebhook(rawBody, headers);

    const payment = await this.paymentModel.findOne({ providerReference: event.providerReference });
    if (!payment) {
      throw new BadRequestException('Pagamento não encontrado para esta referência');
    }

    if (event.status !== 'paid') {
      payment.status = event.status === 'expired' ? PaymentStatus.EXPIRED : PaymentStatus.CANCELED;
      payment.webhookPayload = event.raw as Record<string, unknown>;
      await payment.save();
      return { received: true };
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      return { received: true, alreadyProcessed: true };
    }

    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmedAt = new Date();
    payment.webhookPayload = event.raw as Record<string, unknown>;
    await payment.save();

    const order = await this.ordersService.markAsPaid(payment.orderId.toString());
    await this.enrollmentsService.activateFromPayment(
      order.studentId.toString(),
      order.courseId.toString(),
      order.id,
      order.moduleId?.toString(),
    );

    await this.auditService.log('payment.confirmed', {
      targetType: 'Order',
      targetId: order.id,
      metadata: { providerReference: event.providerReference, amount: order.amount },
    });

    return { received: true };
  }
}
