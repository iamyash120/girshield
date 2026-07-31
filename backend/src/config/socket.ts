import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import { logger } from '../utils/logger';

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthPayload;
    logger.info('WebSocket client connected', { userId: user.userId, role: user.role });

    // Join user's personal room
    socket.join(`user:${user.userId}`);

    // Join role-based room
    socket.join(`role:${user.role}`);

    socket.on('join_village', (villageId: string) => {
      socket.join(`village:${villageId}`);
      logger.debug('User joined village room', { userId: user.userId, villageId });
    });

    socket.on('leave_village', (villageId: string) => {
      socket.leave(`village:${villageId}`);
    });

    socket.on('officer_location_update', async (data: { lat: number; lng: number }) => {
      if (user.role === 'forest_officer') {
        socket.broadcast.to('role:admin').emit('officer_location', {
          officerId: user.userId,
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { userId: user.userId });
    });
  });

  return io;
};

export const getIO = (): Server | null => io;

export const broadcastAlert = (villageId: string, alert: Record<string, unknown>): void => {
  if (io) {
    io.to(`village:${villageId}`).emit('new_alert', alert);
    io.to('role:forest_officer').emit('new_alert', alert);
    io.to('role:admin').emit('new_alert', alert);
  }
};

export const broadcastIncidentUpdate = (incident: Record<string, unknown>): void => {
  if (io) {
    io.to('role:forest_officer').emit('incident_update', incident);
    io.to('role:admin').emit('incident_update', incident);
  }
};
