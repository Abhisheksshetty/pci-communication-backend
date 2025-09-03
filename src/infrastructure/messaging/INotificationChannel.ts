export interface NotificationMessage {
  id?: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  type: 'message' | 'mention' | 'reaction' | 'system' | 'event' | 'reminder';
  category?: string;
  actionUrl?: string;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  timestamp?: Date;
  expiresAt?: Date;
  tags?: string[];
}

export interface NotificationRecipient {
  id: string;
  email?: string;
  phoneNumber?: string;
  deviceTokens?: string[];
  preferences?: NotificationPreferences;
  timezone?: string;
  locale?: string;
}

export interface NotificationPreferences {
  email?: boolean;
  push?: boolean;
  sms?: boolean;
  inApp?: boolean;
  sound?: boolean;
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
  categories?: Record<string, boolean>;
}

export interface BulkNotificationResult {
  successful: string[];
  failed: Array<{
    recipientId: string;
    error: string;
  }>;
  totalSent: number;
  totalFailed: number;
}

export interface NotificationDeliveryStatus {
  messageId: string;
  recipientId: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  error?: string;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface INotificationChannel {
  /**
   * Channel identifier
   */
  readonly channelType: 'email' | 'push' | 'sms' | 'in_app' | 'webhook';

  /**
   * Send notification to a single recipient
   * @param recipient Notification recipient
   * @param message Notification message
   */
  send(recipient: NotificationRecipient, message: NotificationMessage): Promise<NotificationDeliveryStatus>;

  /**
   * Send notification to multiple recipients
   * @param recipients Array of notification recipients
   * @param message Notification message
   */
  sendBulk(recipients: NotificationRecipient[], message: NotificationMessage): Promise<BulkNotificationResult>;

  /**
   * Send templated notification
   * @param recipient Notification recipient
   * @param templateId Template identifier
   * @param variables Template variables
   */
  sendTemplate(
    recipient: NotificationRecipient,
    templateId: string,
    variables: Record<string, any>
  ): Promise<NotificationDeliveryStatus>;

  /**
   * Schedule notification for later delivery
   * @param recipient Notification recipient
   * @param message Notification message
   * @param scheduleTime When to send the notification
   */
  schedule(
    recipient: NotificationRecipient,
    message: NotificationMessage,
    scheduleTime: Date
  ): Promise<string>; // Returns scheduled job ID

  /**
   * Cancel scheduled notification
   * @param jobId Scheduled job ID
   */
  cancelScheduled(jobId: string): Promise<boolean>;

  /**
   * Get delivery status for a message
   * @param messageId Message identifier
   */
  getDeliveryStatus(messageId: string): Promise<NotificationDeliveryStatus[]>;

  /**
   * Validate recipient for this channel
   * @param recipient Notification recipient
   */
  validateRecipient(recipient: NotificationRecipient): Promise<boolean>;

  /**
   * Test channel connectivity
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get channel configuration
   */
  getConfig(): Record<string, any>;

  /**
   * Update channel configuration
   */
  updateConfig(config: Record<string, any>): Promise<void>;
}

export interface NotificationChannelConfig {
  enabled: boolean;
  rateLimit?: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
  };
  templates?: Record<string, NotificationTemplate>;
  defaultSettings?: Partial<NotificationMessage>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string; // For email
  title?: string;
  body: string;
  variables: string[];
  category?: string;
  priority?: NotificationMessage['priority'];
  type: NotificationMessage['type'];
}

export interface ScheduledNotification {
  id: string;
  recipient: NotificationRecipient;
  message: NotificationMessage;
  scheduleTime: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  lastError?: string;
}