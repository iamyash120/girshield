import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock database
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

describe('AuthService', () => {
  it('should be importable', async () => {
    // Dynamic import to allow mocks to be set up first
    const { authService } = await import('../../src/services/auth.service');
    expect(authService).toBeDefined();
    expect(authService.register).toBeDefined();
    expect(authService.login).toBeDefined();
    expect(authService.verifyOTP).toBeDefined();
  });

  it('should throw on invalid credentials', async () => {
    const { query } = await import('../../src/config/database');
    (query as jest.MockedFunction<typeof query>).mockResolvedValueOnce([]);

    const { authService } = await import('../../src/services/auth.service');
    await expect(authService.login('nonexistent@test.com', 'password'))
      .rejects.toThrow('Invalid credentials');
  });
});

describe('WildlifePredictionAgent', () => {
  it('should be importable with correct structure', async () => {
    const { predictionAgent } = await import('../../src/agents/prediction.agent');
    expect(predictionAgent).toBeDefined();
    expect(predictionAgent.predict).toBeDefined();
    expect(predictionAgent.getPredictions).toBeDefined();
  });
});

describe('VillageAlertAgent', () => {
  it('should be importable', async () => {
    const { alertAgent } = await import('../../src/agents/alert.agent');
    expect(alertAgent).toBeDefined();
    expect(alertAgent.processAndBroadcast).toBeDefined();
  });
});

describe('Response utilities', () => {
  it('builds pagination correctly', () => {
    const { buildPagination } = require('../../src/utils/response');
    const pagination = buildPagination(2, 20, 100);
    expect(pagination.page).toBe(2);
    expect(pagination.limit).toBe(20);
    expect(pagination.total).toBe(100);
    expect(pagination.totalPages).toBe(5);
  });

  it('getPagination clamps limit to max 100', () => {
    const { getPagination } = require('../../src/utils/response');
    const { limit } = getPagination('1', '500');
    expect(limit).toBe(100);
  });
});

describe('Crypto utilities', () => {
  it('encrypt and decrypt should round-trip', () => {
    const { encrypt, decrypt } = require('../../src/utils/crypto');
    const original = 'test-secret-data';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });

  it('generateOTP should return 6-digit string', () => {
    const { generateOTP } = require('../../src/utils/crypto');
    const otp = generateOTP(6);
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it('hashOTP should be deterministic', () => {
    const { hashOTP } = require('../../src/utils/crypto');
    const hash1 = hashOTP('123456');
    const hash2 = hashOTP('123456');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });
});
