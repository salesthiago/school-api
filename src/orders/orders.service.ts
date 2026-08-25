import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus, PaymentMethod } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(@InjectModel(Order.name) private orderModel: Model<OrderDocument>) {}

  create(params: {
    studentId: string;
    moduleId?: string;
    courseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
  }): Promise<OrderDocument> {
    return this.orderModel.create({ ...params, status: OrderStatus.PENDING });
  }

  async findById(id: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  findByStudent(studentId: string) {
    return this.orderModel.find({ studentId }).sort({ createdAt: -1 });
  }

  async markAsPaid(id: string) {
    const order = await this.orderModel.findByIdAndUpdate(
      id,
      { status: OrderStatus.PAID, paidAt: new Date() },
      { new: true },
    );
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }
}
