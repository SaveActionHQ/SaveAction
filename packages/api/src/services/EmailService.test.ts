/**
 * EmailService Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService, createTestEmailAccount, type EmailConfig } from './EmailService.js';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
    createTestAccount: vi.fn(),
    getTestMessageUrl: vi.fn(),
  },
}));

describe('EmailService', () => {
  const mockConfig: EmailConfig = {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    user: 'testuser',
    pass: 'testpass',
    from: 'noreply@example.com',
    fromName: 'Test App',
  };

  let mockTransporter: {
    verify: ReturnType<typeof vi.fn>;
    sendMail: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      close: vi.fn(),
    };

    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as never);
    vi.mocked(nodemailer.getTestMessageUrl).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      const service = new EmailService(mockConfig);
      expect(service).toBeInstanceOf(EmailService);
    });
  });

  describe('initialize', () => {
    it('should initialize transporter successfully', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        secure: mockConfig.secure,
        auth: {
          user: mockConfig.user,
          pass: mockConfig.pass,
        },
      });
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(service.isReady()).toBe(true);
    });

    it('should not require auth if user/pass not provided', async () => {
      const configWithoutAuth: EmailConfig = {
        host: 'smtp.example.com',
        port: 25,
        secure: false,
        from: 'noreply@example.com',
      };

      const service = new EmailService(configWithoutAuth);
      await service.initialize();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: configWithoutAuth.host,
        port: configWithoutAuth.port,
        secure: configWithoutAuth.secure,
        auth: undefined,
      });
    });

    it('should throw error if verify fails', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const service = new EmailService(mockConfig);

      await expect(service.initialize()).rejects.toThrow(
        'Failed to connect to SMTP server: Connection failed'
      );
      expect(service.isReady()).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();
      await service.initialize();

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      const service = new EmailService(mockConfig);
      expect(service.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();

      const result = await service.send({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test body',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test App" <noreply@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test body',
        html: '<p>Test body</p>',
      });
    });

    it('should use from address without name if fromName not provided', async () => {
      const configWithoutName: EmailConfig = {
        ...mockConfig,
        fromName: undefined,
      };
      const service = new EmailService(configWithoutName);
      await service.initialize();

      await service.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
        })
      );
    });

    it('should return error if not initialized', async () => {
      const service = new EmailService(mockConfig);

      const result = await service.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service not initialized');
    });

    it('should return error if sendMail fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const service = new EmailService(mockConfig);
      await service.initialize();

      const result = await service.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP error');
    });

    it('should include preview URL if available', async () => {
      vi.mocked(nodemailer.getTestMessageUrl).mockReturnValue('https://ethereal.email/message/123');

      const service = new EmailService(mockConfig);
      await service.initialize();

      const result = await service.send({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.previewUrl).toBe('https://ethereal.email/message/123');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct content', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();

      const result = await service.sendPasswordResetEmail({
        email: 'user@example.com',
        name: 'John Doe',
        resetToken: 'test-token',
        resetUrl: 'https://app.example.com/reset-password?token=test-token',
        expiresInMinutes: 60,
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset Your Password - SaveAction',
        })
      );

      // Check that HTML and text contain the reset URL
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://app.example.com/reset-password?token=test-token');
      expect(callArgs.text).toContain('https://app.example.com/reset-password?token=test-token');
      expect(callArgs.html).toContain('Hi John Doe');
      expect(callArgs.text).toContain('Hi John Doe');
      expect(callArgs.html).toContain('60 minutes');
    });

    it('should use generic greeting if name not provided', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();

      await service.sendPasswordResetEmail({
        email: 'user@example.com',
        name: null,
        resetToken: 'test-token',
        resetUrl: 'https://app.example.com/reset-password?token=test-token',
        expiresInMinutes: 60,
      });

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Hi,');
      expect(callArgs.text).toContain('Hi,');
    });
  });

  describe('close', () => {
    it('should close transporter', async () => {
      const service = new EmailService(mockConfig);
      await service.initialize();
      await service.close();

      expect(mockTransporter.close).toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
    });

    it('should handle close when not initialized', async () => {
      const service = new EmailService(mockConfig);
      await service.close();
      // Should not throw
    });
  });
});

describe('createTestEmailAccount', () => {
  it('should create test account config', async () => {
    vi.mocked(nodemailer.createTestAccount).mockResolvedValue({
      user: 'testuser@ethereal.email',
      pass: 'testpass123',
      smtp: {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
      },
      imap: {
        host: 'imap.ethereal.email',
        port: 993,
        secure: true,
      },
      pop3: {
        host: 'pop3.ethereal.email',
        port: 995,
        secure: true,
      },
      web: 'https://ethereal.email',
    });

    const config = await createTestEmailAccount();

    expect(config).toEqual({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      user: 'testuser@ethereal.email',
      pass: 'testpass123',
      from: 'testuser@ethereal.email',
      fromName: 'SaveAction (Test)',
      preview: true,
    });
  });
});
