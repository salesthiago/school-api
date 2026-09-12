import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaymentProviderKey } from '../common/enums/payment-provider-key.enum';
import {
  CurrentUser,
  JwtUser,
} from '../common/decorators/current-user.decorator';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: JwtUser) {
    return this.paymentsService.checkout(dto, user);
  }

  @Post('webhook/:provider')
  @HttpCode(200)
  handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RequestWithRawBody,
    @Headers() headers: Record<string, string>,
  ) {
    const key = (Object.values(PaymentProviderKey) as string[]).includes(
      provider,
    )
      ? (provider as PaymentProviderKey)
      : null;
    if (!key) {
      throw new BadRequestException(
        `Provedor de webhook desconhecido: ${provider}`,
      );
    }
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.paymentsService.handleWebhook(key, rawBody, headers);
  }
}
