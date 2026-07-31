import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AuthPayload, User, UserRole } from '../types';
import { generateOTP, hashOTP, generateToken } from '../utils/crypto';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10');

export class AuthService {
  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    village_id?: string;
  }): Promise<{ user: Partial<User>; message: string }> {
    const existing = await query<User>(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [data.email, data.phone]
    );
    if (existing.length > 0) {
      throw createError('User with this email or phone already exists', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const [user] = await query<User>(
      `INSERT INTO users (name, email, phone, password_hash, role, village_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, role, village_id, is_verified, is_active, created_at`,
      [data.name, data.email, data.phone, passwordHash, data.role, data.village_id || null]
    );

    // If role is forest_officer, create officer record
    if (data.role === 'forest_officer') {
      const officerId = `FO${Date.now().toString().slice(-6)}`;
      await query(
        'INSERT INTO forest_officers (user_id, officer_id, designation) VALUES ($1, $2, $3)',
        [user.id, officerId, 'Forest Officer']
      );
    }

    // Generate email OTP
    await this.generateOTP(data.email, 'email_verification');

    return { user, message: 'Registration successful. Please verify your email.' };
  }

  async login(emailOrPhone: string, password: string, deviceInfo?: string, ipAddress?: string) {
    const [user] = await query<User & { password_hash: string; failed_login_attempts: number; locked_until: Date | null }>(
      `SELECT id, name, email, phone, role, password_hash, is_verified, is_active, 
              failed_login_attempts, locked_until, village_id
       FROM users WHERE email = $1 OR phone = $1`,
      [emailOrPhone]
    );

    if (!user) throw createError('Invalid credentials', 401);
    if (!user.is_active) throw createError('Account has been deactivated', 401);

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      throw createError('Account temporarily locked. Try again later.', 429);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );
      throw createError('Invalid credentials', 401);
    }

    // Reset failed attempts
    await query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
    });
    const refreshToken = generateToken();
    const refreshTokenHash = hashOTP(refreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshTokenHash, deviceInfo || null, ipAddress || null, expiresAt]
    );

    const { password_hash: _, failed_login_attempts: __, locked_until: ___, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    const tokenHash = hashOTP(refreshToken);
    const [session] = await query<{ id: string; user_id: string; expires_at: Date }>(
      'SELECT id, user_id, expires_at FROM sessions WHERE refresh_token_hash = $1 AND is_active = TRUE',
      [tokenHash]
    );

    if (!session) throw createError('Invalid refresh token', 401);
    if (new Date() > new Date(session.expires_at)) {
      await query('UPDATE sessions SET is_active = FALSE WHERE id = $1', [session.id]);
      throw createError('Refresh token expired', 401);
    }

    const [user] = await query<User>(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = TRUE',
      [session.user_id]
    );
    if (!user) throw createError('User not found', 401);

    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
    });
    const newRefreshToken = generateToken();
    const newRefreshTokenHash = hashOTP(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE sessions SET refresh_token_hash = $1, expires_at = $2 WHERE id = $3`,
      [newRefreshTokenHash, expiresAt, session.id]
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async generateOTP(identifier: string, purpose: string): Promise<string> {
    const otp = generateOTP(6);
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO otp_verifications (identifier, otp_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [identifier, otpHash, purpose, expiresAt]
    );

    logger.info(`OTP generated for ${identifier} (${purpose})`);
    return otp; // In production, send via email/SMS
  }

  async verifyOTP(identifier: string, otp: string, purpose: string): Promise<boolean> {
    const otpHash = hashOTP(otp);
    const [record] = await query<{ id: string; attempts: number; expires_at: Date; is_used: boolean }>(
      `SELECT id, attempts, expires_at, is_used FROM otp_verifications
       WHERE identifier = $1 AND otp_hash = $2 AND purpose = $3
       ORDER BY created_at DESC LIMIT 1`,
      [identifier, otpHash, purpose]
    );

    if (!record || record.is_used) throw createError('Invalid or expired OTP', 400);
    if (new Date() > new Date(record.expires_at)) throw createError('OTP has expired', 400);
    if (record.attempts >= 3) throw createError('Too many failed attempts', 429);

    await query(
      'UPDATE otp_verifications SET is_used = TRUE WHERE id = $1',
      [record.id]
    );

    // Mark email as verified
    if (purpose === 'email_verification') {
      await query('UPDATE users SET is_verified = TRUE WHERE email = $1', [identifier]);
    }

    return true;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashOTP(refreshToken);
    await query(
      'UPDATE sessions SET is_active = FALSE WHERE refresh_token_hash = $1',
      [tokenHash]
    );
  }

  async getUserById(userId: string): Promise<Partial<User> | null> {
    const [user] = await query<Partial<User>>(
      `SELECT id, name, email, phone, role, village_id, is_verified, is_active, 
              avatar_url, preferred_language, last_login_at, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    return user || null;
  }
}

export const authService = new AuthService();
