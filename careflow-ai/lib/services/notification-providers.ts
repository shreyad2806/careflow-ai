/**
 * Notification Delivery Providers
 *
 * Provider abstraction for notification delivery channels.
 * Each provider handles one channel (in_app, email, push).
 *
 * - InAppNotificationProvider: confirms record exists (always succeeds).
 * - EmailNotificationProvider: sends real email via Resend in production,
 *   logs to console in development when not configured.
 *
 * Providers NEVER throw on failure. They return a result object.
 * The notification service handles retries.
 */

import { Resend } from 'resend';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================
// Provider result types
// ============================================================

export interface DeliverySuccess {
  ok: true;
  channel: string;
}

export interface DeliveryFailure {
  ok: false;
  channel: string;
  error: string;
  message: string;
}

export type DeliveryResult = DeliverySuccess | DeliveryFailure;

// ============================================================
// Provider interface
// ============================================================

export interface NotificationProvider {
  readonly channel: string;
  send(input: {
    recipientId: string;
    title: string;
    message: string;
    /** Optional data payload for rich notifications */
    data?: Record<string, unknown>;
  }): Promise<DeliveryResult>;
}

// ============================================================
// In-App Provider (database notification)
// ============================================================

/**
 * In-app notification provider.
 *
 * "Delivery" for in-app means the record exists in the notifications table.
 * Since we create the record before attempting delivery, the in-app provider
 * simply confirms the record exists. This is always a no-op success.
 *
 * Real in-app delivery (websockets, push) would be added here.
 */
export class InAppNotificationProvider implements NotificationProvider {
  readonly channel = 'in_app';

  async send(_input: {
    recipientId: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<DeliveryResult> {
    // In-app notifications are delivered by virtue of existing in the DB.
    // A real implementation might send a websocket event here.
    return { ok: true, channel: 'in_app' };
  }
}

// ============================================================
// Email Provider (Resend-backed)
// ============================================================

/**
 * Email notification provider using Resend.
 *
 * Behavior:
 *   - Production with valid API key: sends real email via Resend.
 *   - Development without API key: logs the email to console (safe mock).
 *   - Disabled when EMAIL_PROVIDER_ENABLED != 'true'.
 *
 * Recipient email is resolved from the profiles table at send time.
 * If the profile has no email, delivery fails with a clear error.
 */
export class EmailNotificationProvider implements NotificationProvider {
  readonly channel = 'email';

  private resend: Resend | null = null;
  private enabled: boolean;
  private fromAddress: string;
  private isDev: boolean;

  constructor(
    private config?: {
      apiKey?: string;
      fromAddress?: string;
      enabled?: boolean;
    }
  ) {
    this.enabled = !!(config?.enabled && config?.apiKey);
    this.fromAddress = config?.fromAddress || 'CareFlow <notifications@careflow.ai>';
    this.isDev = process.env.NODE_ENV !== 'production';

    if (this.enabled && config?.apiKey) {
      this.resend = new Resend(config.apiKey);
    }

    // Development diagnostics
    if (this.isDev) {
      if (this.enabled) {
        console.log(`[EmailProvider] ✅ Initialized: provider=resend mode=live from=${this.fromAddress}`);
      } else {
        console.log(`[EmailProvider] ℹ️  Initialized: provider=resend mode=dev-mock (no API key or EMAIL_PROVIDER_ENABLED!=true)`);
      }
    }
  }

  /**
   * Look up the recipient's email address from the profiles table.
   */
  private async resolveRecipientEmail(profileId: string): Promise<string | null> {
    try {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', profileId)
        .single();

      if (error || !data?.email) {
        return null;
      }
      return data.email;
    } catch {
      return null;
    }
  }

  async send(input: {
    recipientId: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<DeliveryResult> {
    const attemptTag = Math.random().toString(36).slice(2, 8);

    // --- Dev mock mode: log and return success (no email resolution needed) ---
    if (!this.enabled || !this.resend) {
      console.log(
        `[EmailProvider] 📧 DEV MOCK id=${input.recipientId} attempt=${attemptTag}\n` +
        `  subject: ${input.title}\n` +
        `  body: ${input.message}`
      );
      // Return success so notification service marks it as delivered.
      // Prevents notifications from being stuck in FAILED/PENDING
      // during local development when no email service is configured.
      return { ok: true, channel: 'email' };
    }

    // --- Live mode: resolve recipient email then send via Resend ---
    const recipientEmail = await this.resolveRecipientEmail(input.recipientId);
    if (!recipientEmail) {
      const error = 'RECIPIENT_NOT_FOUND';
      const msg = `Could not resolve email for profile ${input.recipientId}`;
      console.error(`[EmailProvider] ❌ id=${input.recipientId} attempt=${attemptTag} error=${error} ${msg}`);
      return { ok: false, channel: 'email', error, message: msg };
    }

    console.log(
      `[EmailProvider] 📤 id=${input.recipientId} attempt=${attemptTag} provider=resend to=${recipientEmail}`
    );

    try {
      const { data, error } = await this.resend!.emails.send({
        from: this.fromAddress,
        to: recipientEmail,
        subject: input.title,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1e293b; margin-bottom: 16px;">${input.title}</h2>
  <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">${input.message}</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="color: #94a3b8; font-size: 12px;">CareFlow AI — Intelligent Healthcare Platform</p>
</div>`,
        text: `${input.title}\n\n${input.message}\n\n— CareFlow AI`,
      });

      if (error) {
        const errorMsg = error.message || String(error);
        console.error(`[EmailProvider] ❌ id=${input.recipientId} attempt=${attemptTag} provider=resend error=${errorMsg}`);
        return {
          ok: false,
          channel: 'email',
          error: 'RESEND_API_ERROR',
          message: `Resend error: ${errorMsg}`,
        };
      }

      console.log(
        `[EmailProvider] ✅ id=${input.recipientId} attempt=${attemptTag} provider=resend emailId=${data?.id} delivered to=${recipientEmail}`
      );
      return { ok: true, channel: 'email' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[EmailProvider] ❌ id=${input.recipientId} attempt=${attemptTag} provider=resend thrown=${errorMsg}`);
      return {
        ok: false,
        channel: 'email',
        error: 'RESEND_EXCEPTION',
        message: `Resend exception: ${errorMsg}`,
      };
    }
  }
}

// ============================================================
// Provider registry
// ============================================================

const _providers = new Map<string, NotificationProvider>();

/**
 * Register a notification provider for a channel.
 */
export function registerProvider(provider: NotificationProvider): void {
  _providers.set(provider.channel, provider);
}

/**
 * Get the provider for a channel. Falls back to in-app if not registered.
 */
export function getProvider(channel: string): NotificationProvider {
  return _providers.get(channel) || _providers.get('in_app')!;
}

/**
 * Initialize default providers.
 *
 * Reads configuration from environment variables:
 *   EMAIL_PROVIDER_ENABLED  — 'true' to enable real email sending
 *   EMAIL_PROVIDER_API_KEY  — Resend API key (re_...)
 *   EMAIL_FROM_ADDRESS      — sender address (default: noreply@careflow.ai)
 *
 * In development without these vars, the email provider runs in
 * safe mock mode that logs emails to the console.
 */
export function initializeProviders(): void {
  registerProvider(new InAppNotificationProvider());
  registerProvider(
    new EmailNotificationProvider({
      enabled: process.env.EMAIL_PROVIDER_ENABLED === 'true',
      apiKey: process.env.EMAIL_PROVIDER_API_KEY,
      fromAddress: process.env.EMAIL_FROM_ADDRESS || 'CareFlow <noreply@careflow.ai>',
    })
  );
}

// Auto-initialize on import
initializeProviders();
