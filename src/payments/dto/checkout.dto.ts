import { IsEnum, IsMongoId } from 'class-validator';
import { PaymentMethod } from '../../orders/schemas/order.schema';

export class CheckoutDto {
  @IsMongoId()
  moduleId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
