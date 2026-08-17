import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  create(userId: string, title: string, message?: string) {
    return this.notificationModel.create({ userId, title, message });
  }

  findByUser(userId: string) {
    return this.notificationModel.find({ userId }).sort({ createdAt: -1 }).limit(100);
  }

  async markRead(id: string, userId: string) {
    await this.notificationModel.updateOne({ _id: id, userId }, { read: true });
  }
}
