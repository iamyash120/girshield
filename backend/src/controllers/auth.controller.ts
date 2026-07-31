import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';

const registerSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  password: z.string().min(8).max(100),
  role: z.enum(['villager', 'forest_officer', 'admin']).default('villager'),
  village_id: z.string().uuid().optional(),
});

const loginSchema = z.object({
  credential: z.string().min(1),
  password: z.string().min(1),
});

const otpSchema = z.object({
  identifier: z.string().min(1),
  otp: z.string().length(6),
  purpose: z.string().min(1),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);
  const result = await authService.register(data as { name: string; email: string; phone: string; password: string; role: UserRole; village_id?: string });
  sendCreated(res, result, result.message);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { credential, password } = loginSchema.parse(req.body);
  const deviceInfo = req.headers['user-agent'];
  const ipAddress = req.ip;
  const result = await authService.login(credential, password, deviceInfo, ipAddress);
  sendSuccess(res, result, 'Login successful');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;
  if (!token) {
    sendError(res, 'Refresh token required', 400);
    return;
  }
  const result = await authService.refreshTokens(token);
  sendSuccess(res, result, 'Tokens refreshed');
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, otp, purpose } = otpSchema.parse(req.body);
  await authService.verifyOTP(identifier, otp, purpose);
  sendSuccess(res, null, 'OTP verified successfully');
});

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, purpose } = req.body;
  if (!identifier || !purpose) {
    sendError(res, 'Identifier and purpose required', 400);
    return;
  }
  const otp = await authService.generateOTP(identifier, purpose);
  // In production, send OTP via email/SMS — return it only in development
  const devData = process.env.NODE_ENV === 'development' ? { otp } : {};
  sendSuccess(res, devData, 'OTP sent successfully');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;
  if (token) await authService.logout(token);
  sendSuccess(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getUserById(req.user!.userId);
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }
  sendSuccess(res, user, 'User profile retrieved');
});
