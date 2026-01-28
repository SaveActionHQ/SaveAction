/**
 * Email Service
 *
 * Handles email sending using nodemailer.
 * Supports SMTP and various transports.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

/**
 * Email configuration
 */
export interface EmailConfig {
  /** SMTP host */
  host: string;
  /** SMTP port */
  port: number;
  /** Use TLS/SSL */
  secure: boolean;
  /** SMTP username */
  user?: string;
  /** SMTP password */
  pass?: string;
  /** From email address */
  from: string;
  /** From name */
  fromName?: string;
  /** Enable preview in development (opens email in browser) */
  preview?: boolean;
}

/**
 * Email options for sending
 */
export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

/**
 * Password reset email data
 */
export interface PasswordResetEmailData {
  email: string;
  name?: string | null;
  resetToken: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * Email Service class
 */
export class EmailService {
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private readonly config: EmailConfig;
  private initialized = false;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  /**
   * Initialize the email transporter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth:
        this.config.user && this.config.pass
          ? {
              user: this.config.user,
              pass: this.config.pass,
            }
          : undefined,
    });

    // Verify connection
    try {
      await this.transporter.verify();
      this.initialized = true;
    } catch (error) {
      this.transporter = null;
      throw new Error(
        `Failed to connect to SMTP server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if email service is configured and ready
   */
  isReady(): boolean {
    return this.initialized && this.transporter !== null;
  }

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not initialized',
      };
    }

    try {
      const fromAddress = this.config.fromName
        ? `"${this.config.fromName}" <${this.config.from}>`
        : this.config.from;

      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<EmailResult> {
    const greeting = data.name ? `Hi ${data.name}` : 'Hi';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SaveAction</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
    
    <p>${greeting},</p>
    
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">This link will expire in <strong>${data.expiresInMinutes} minutes</strong>.</p>
    
    <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${data.resetUrl}</p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    
    <p style="color: #999; font-size: 12px;">— The SaveAction Team</p>
  </div>
</body>
</html>
    `.trim();

    const text = `
${greeting},

We received a request to reset your password.

Click the link below to create a new password:
${data.resetUrl}

This link will expire in ${data.expiresInMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email.

— The SaveAction Team
    `.trim();

    return this.send({
      to: data.email,
      subject: 'Reset Your Password - SaveAction',
      text,
      html,
    });
  }

  /**
   * Close the transporter connection
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.initialized = false;
    }
  }
}

/**
 * Create a test email account using Ethereal (for development)
 */
export async function createTestEmailAccount(): Promise<EmailConfig> {
  const testAccount = await nodemailer.createTestAccount();

  return {
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    user: testAccount.user,
    pass: testAccount.pass,
    from: testAccount.user,
    fromName: 'SaveAction (Test)',
    preview: true,
  };
}
