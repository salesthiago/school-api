import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaymentMethod } from '../../orders/schemas/order.schema';

export class CheckoutDto {
  /** Obrigatório só quando moduleId está ausente (compra da trilha avulsa do curso). */
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
