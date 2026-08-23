/**
 * Development-only logger for the data adapter layer.
 *
 * Every function is a no-op in production.
 * All output is prefixed with [DataAdapter] for easy terminal filtering.
 * Never logs secrets, keys, or full credential strings.
 */

const isDev = process.env.NODE_ENV !== 'production';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  /** Which service function called the log (e.g. "getDoctors") */
  service: string;
  /** Which page/route triggered the fetch (e.g. "/patient/doctors") */
  route?: string;
}

function format(level: LogLevel, ctx: LogContext, message: string): string {
  const routeTag = ctx.route ? ` [${ctx.route}]` : '';
  return `[DataAdapter]${routeTag} ${ctx.service}: ${message}`;
}

/**
 * Log a successful Supabase read.
 *
 * @example
 * logSupabaseRead({ service: 'getDoctors', route: '/patient/doctors' }, 3)
 */
export function logSupabaseRead(
  ctx: LogContext,
  recordCount: number,
): void {
  if (!isDev) return;
  console.log(format('info', ctx, `✅ Supabase read OK — ${recordCount} record(s)`));
}

/**
 * Log that the adapter is falling back to mock data and why.
 */
export function logMockFallback(
  ctx: LogContext,
  reason: 'not-configured' | 'empty-result' | 'query-failed',
  detail?: string,
): void {
  if (!isDev) return;

  const reasonMap: Record<typeof reason, string> = {
    'not-configured': 'Supabase not configured — using mock data',
    'empty-result': 'Supabase returned 0 records — using mock data',
    'query-failed': `Supabase query failed — using mock data${detail ? ': ' + detail : ''}`,
  };

  console.warn(format('warn', ctx, `⚠️  FALLBACK → ${reasonMap[reason]}`));
}

/**
 * Log a Supabase query error with useful context.
 * Strips any sensitive connection details from the error object.
 */
export function logSupabaseError(
  ctx: LogContext,
  error: unknown,
): void {
  if (!isDev) return;

  let message: string;
  if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'Unknown error';
  }

  // Sanitize: remove any URLs that might contain credentials
  const sanitized = message
    .replace(/https?:\/\/[^\s]+/g, '[redacted-url]')
    .replace(/key=[^\s&]+/g, 'key=[redacted]');

  console.error(format('error', ctx, `❌ ${sanitized}`));
}

/**
 * Log a Supabase configuration check result.
 * Called once per adapter invocation to show which mode is active.
 */
export function logSourceMode(
  ctx: LogContext,
  configured: boolean,
): void {
  if (!isDev) return;

  if (configured) {
    console.log(format('info', ctx, '🔗 Source: Supabase'));
  } else {
    console.log(format('info', ctx, '📦 Source: Mock data (Supabase not configured)'));
  }
}
