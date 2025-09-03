// Fallback types for Nodemailer when not installed
interface SendMailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  bcc?: string[];
  headers?: Record<string, string>;
}

interface Transporter {
  sendMail(options: SendMailOptions): Promise<any>;
  verify(): Promise<boolean>;
  verify(callback: (error: any, success: any) => void): void;
}

// Try to import Nodemailer, fallback to mock if not available
let nodemailer: {
  createTransporter: (config: any) => Transporter;
};

try {
  nodemailer = require('nodemailer');
} catch (error) {
  // Mock Nodemailer for development/testing when not installed
  nodemailer = {
    createTransporter: (config: any) => ({
      sendMail: async (options: SendMailOptions) => ({
        messageId: `mock-${Date.now()}`,
        response: 'Mock email sent successfully',
      }),
      verify: (callback?: (error: any, success: any) => void) => {
        if (callback) {
          callback(null, true);
          return undefined as any;
        }
        return Promise.resolve(true);
      },
    }) as Transporter,
  };
}
import {
  INotificationChannel,
  NotificationMessage,
  NotificationRecipient,
  NotificationDeliveryStatus,
  BulkNotificationResult,
  NotificationChannelConfig,
  NotificationTemplate
} from './INotificationChannel.js';

export interface EmailChannelConfig extends NotificationChannelConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
  from: {
    name: string;
    address: string;
  };
  replyTo?: string;
  bcc?: string[];
  attachments?: {
    maxSize: number; // in bytes
    allowedTypes: string[];
  };
}

export class EmailChannel implements INotificationChannel {
  readonly channelType = 'email' as const;
  private transporter!: Transporter;
  private config: EmailChannelConfig;
  private isConnected = false;

  constructor(config: EmailChannelConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransporter({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.auth,
      pool: true, // Use connection pool
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: this.config.rateLimit?.maxPerMinute || 50,
    });

    // Verify connection on startup
    this.transporter.verify((error: any, success: any) => {
      if (error) {
        console.error('Email transporter verification failed:', error);
        this.isConnected = false;
      } else {
        console.log('Email server is ready to send messages');
        this.isConnected = true;
      }
    });
  }

  async send(recipient: NotificationRecipient, message: NotificationMessage): Promise<NotificationDeliveryStatus> {
    const deliveryStatus: NotificationDeliveryStatus = {
      messageId: message.id || this.generateMessageId(),
      recipientId: recipient.id,
      status: 'pending',
      timestamp: new Date(),
    };

    try {
      if (!this.config.enabled) {
        throw new Error('Email channel is disabled');
      }

      if (!(await this.validateRecipient(recipient))) {
        throw new Error('Invalid recipient email address');
      }

      // Check if recipient has email notifications enabled
      if (recipient.preferences?.email === false) {
        deliveryStatus.status = 'failed';
        deliveryStatus.error = 'Recipient has disabled email notifications';
        return deliveryStatus;
      }

      const mailOptions = this.buildMailOptions(recipient, message);
      const result = await this.transporter.sendMail(mailOptions);

      deliveryStatus.status = 'sent';
      deliveryStatus.deliveredAt = new Date();
      deliveryStatus.messageId = result.messageId || deliveryStatus.messageId;

      console.log(`Email sent successfully to ${recipient.email}`, {
        messageId: result.messageId,
        response: result.response,
      });

    } catch (error) {
      deliveryStatus.status = 'failed';
      deliveryStatus.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Failed to send email to ${recipient.email}:`, error);
    }

    return deliveryStatus;
  }

  async sendBulk(recipients: NotificationRecipient[], message: NotificationMessage): Promise<BulkNotificationResult> {
    const result: BulkNotificationResult = {
      successful: [],
      failed: [],
      totalSent: 0,
      totalFailed: 0,
    };

    // Process in batches to respect rate limits
    const batchSize = Math.min(this.config.rateLimit?.maxPerMinute || 50, 20);
    const batches = this.chunkArray(recipients, batchSize);

    for (const batch of batches) {
      const promises = batch.map(async (recipient) => {
        try {
          const status = await this.send(recipient, message);
          if (status.status === 'sent') {
            result.successful.push(recipient.id);
            result.totalSent++;
          } else {
            result.failed.push({
              recipientId: recipient.id,
              error: status.error || 'Failed to send',
            });
            result.totalFailed++;
          }
        } catch (error) {
          result.failed.push({
            recipientId: recipient.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          result.totalFailed++;
        }
      });

      await Promise.allSettled(promises);

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(1000); // 1 second delay between batches
      }
    }

    return result;
  }

  async sendTemplate(
    recipient: NotificationRecipient,
    templateId: string,
    variables: Record<string, any>
  ): Promise<NotificationDeliveryStatus> {
    const template = this.config.templates?.[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const compiledMessage = this.compileTemplate(template, variables);
    return this.send(recipient, compiledMessage);
  }

  async schedule(
    recipient: NotificationRecipient,
    message: NotificationMessage,
    scheduleTime: Date
  ): Promise<string> {
    // This would integrate with a job queue like Bull or Agenda
    // For now, we'll simulate scheduling with setTimeout (not recommended for production)
    const jobId = this.generateJobId();
    const delay = scheduleTime.getTime() - Date.now();

    if (delay <= 0) {
      throw new Error('Schedule time must be in the future');
    }

    setTimeout(async () => {
      try {
        await this.send(recipient, message);
        console.log(`Scheduled email sent to ${recipient.email} at ${scheduleTime}`);
      } catch (error) {
        console.error(`Failed to send scheduled email:`, error);
      }
    }, delay);

    console.log(`Email scheduled for ${recipient.email} at ${scheduleTime} with job ID: ${jobId}`);
    return jobId;
  }

  async cancelScheduled(jobId: string): Promise<boolean> {
    // This would integrate with a job queue to cancel scheduled jobs
    // For the setTimeout implementation, we can't cancel it easily
    console.log(`Cancel scheduled email job: ${jobId} (not implemented for setTimeout)`);
    return false;
  }

  async getDeliveryStatus(messageId: string): Promise<NotificationDeliveryStatus[]> {
    // This would query a database or external service for delivery status
    // For now, return empty array
    console.log(`Get delivery status for message: ${messageId}`);
    return [];
  }

  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    if (!recipient.email) {
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient.email);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email health check failed:', error);
      return false;
    }
  }

  getConfig(): Record<string, any> {
    return {
      ...this.config,
      smtp: {
        ...this.config.smtp,
        auth: this.config.smtp.auth ? { user: this.config.smtp.auth.user } : undefined,
      },
    };
  }

  async updateConfig(config: Record<string, any>): Promise<void> {
    this.config = { ...this.config, ...config } as EmailChannelConfig;
    this.initializeTransporter();
  }

  private buildMailOptions(recipient: NotificationRecipient, message: NotificationMessage): SendMailOptions {
    const mailOptions: SendMailOptions = {
      from: `${this.config.from.name} <${this.config.from.address}>`,
      to: recipient.email || '',
      subject: message.title,
      html: this.buildHtmlContent(message),
      text: message.body || message.title,
    };

    if (this.config.replyTo) {
      mailOptions.replyTo = this.config.replyTo;
    }

    if (this.config.bcc && this.config.bcc.length > 0) {
      mailOptions.bcc = this.config.bcc;
    }

    // Add custom headers
    mailOptions.headers = {
      'X-Message-Type': message.type,
      'X-Priority': this.getPriorityHeader(message.priority),
      ...(message.id && { 'X-Message-ID': message.id }),
    };

    return mailOptions;
  }

  private buildHtmlContent(message: NotificationMessage): string {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin: 0 0 16px 0;">${message.title}</h2>
    `;

    if (message.body) {
      html += `<p style="color: #666; line-height: 1.5; margin: 0 0 16px 0;">${message.body}</p>`;
    }

    if (message.actionUrl) {
      html += `
        <div style="margin: 20px 0;">
          <a href="${message.actionUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            View Details
          </a>
        </div>
      `;
    }

    if (message.imageUrl) {
      html += `<img src="${message.imageUrl}" alt="" style="max-width: 100%; height: auto; margin: 16px 0;">`;
    }

    html += `
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated message from Sports Communication App.
            </p>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  private compileTemplate(template: NotificationTemplate, variables: Record<string, any>): NotificationMessage {
    let compiledTitle = template.title || template.subject || '';
    let compiledBody = template.body;

    // Simple template variable replacement
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      compiledTitle = compiledTitle.replace(new RegExp(placeholder, 'g'), String(value));
      compiledBody = compiledBody.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return {
      title: compiledTitle,
      body: compiledBody,
      type: template.type,
      priority: template.priority,
      category: template.category,
    };
  }

  private getPriorityHeader(priority?: NotificationMessage['priority']): string {
    switch (priority) {
      case 'urgent': return '1 (Highest)';
      case 'high': return '2 (High)';
      case 'normal': return '3 (Normal)';
      case 'low': return '4 (Low)';
      default: return '3 (Normal)';
    }
  }

  private generateMessageId(): string {
    return `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}