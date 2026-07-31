import { query } from '../config/database';
import { Notification, NotificationType } from '../types';
import { logger } from '../utils/logger';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const [notification] = await query<Notification>(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.userId, input.type, input.title, input.body, JSON.stringify(input.data || {})]
    );
    
    // Emit via WebSocket if connected
    this.emitToUser(input.userId, notification);
    
    return notification;
  }

  async getUserNotifications(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const offset = (page - 1) * limit;
    const where = unreadOnly ? 'WHERE user_id = $1 AND is_read = FALSE' : 'WHERE user_id = $1';
    
    const [count] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM notifications ${where}`, [userId]
    );
    const notifications = await query<Notification>(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    return { notifications, total: parseInt(count?.count || '0'), unread: 0 };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await query<{ count: string }>(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    return parseInt(result?.count || '0');
  }

  async broadcastToVillage(villageId: string, notification: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
    const villagers = await query<{ id: string }>(
      "SELECT id FROM users WHERE village_id = $1 AND is_active = TRUE",
      [villageId]
    );
    
    for (const villager of villagers) {
      await this.createNotification({ ...notification, userId: villager.id });
    }
    
    logger.info(`Broadcast notification sent to ${villagers.length} users in village ${villageId}`);
  }

  async broadcastToRole(role: string, notification: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
    const users = await query<{ id: string }>(
      'SELECT id FROM users WHERE role = $1 AND is_active = TRUE',
      [role]
    );
    
    for (const user of users) {
      await this.createNotification({ ...notification, userId: user.id });
    }
  }

  private emitToUser(userId: string, notification: Notification): void {
    try {
      // Import dynamically to avoid circular dependency with socket setup
      const { getIO } = require('../config/socket');
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('notification', notification);
      }
    } catch {
      // Socket not initialized yet
    }
  }
}

export const notificationService = new NotificationService();
