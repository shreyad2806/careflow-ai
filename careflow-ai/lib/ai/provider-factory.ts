/**
 * Provider factory — selects the appropriate AI provider based on environment.
 *
 * Selection logic:
 *   1. If AI_PROVIDER=mock → MockSymptomProvider (default, always works)
 *   2. If AI_PROVIDER=openai (or not set) and OPENAI_API_KEY exists → OpenAIProvider
 *   3. If AI_PROVIDER=openai but no OPENAI_API_KEY → falls back to mock + warning
 *
 * This keeps the mock provider always available for development and testing,
 * while allowing a seamless switch to OpenAI when credentials are configured.
 *
 * Environment variables:
 *   AI_PROVIDER       — 'mock' | 'openai' (default: auto-detect)
 *   OPENAI_API_KEY    — Required for OpenAI provider
 *   OPENAI_MODEL      — Optional, defaults to 'gpt-4o-mini'
 */

import type { SymptomAIProvider } from './provider';
import { MockSymptomProvider } from './mock-provider';

// ============================================================
// Singleton provider instance
// ============================================================

let _provider: SymptomAIProvider | null = null;

/**
 * Get the active AI provider.
 *
 * Selection:
 *   - AI_PROVIDER=mock → always mock
 *   - AI_PROVIDER=openai + OPENAI_API_KEY → OpenAI
 *   - AI_PROVIDER=openai + no key → mock (with warning)
 *   - AI_PROVIDER unset + OPENAI_API_KEY → OpenAI
 *   - AI_PROVIDER unset + no key → mock
 */
export function getProvider(): SymptomAIProvider {
  if (_provider) return _provider;

  const configuredProvider = process.env.AI_PROVIDER?.toLowerCase();
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  // Explicit mock
  if (configuredProvider === 'mock') {
    _provider = new MockSymptomProvider();
    log('info', 'Provider: mock (explicitly configured via AI_PROVIDER=mock)');
    return _provider;
  }

  // Explicit openai or auto-detect with key present
  if (
    configuredProvider === 'openai' ||
    (!configuredProvider && hasOpenAIKey)
  ) {
    if (!hasOpenAIKey) {
      log(
        'warn',
        'AI_PROVIDER=openai but OPENAI_API_KEY is not set. Falling back to mock.'
      );
      _provider = new MockSymptomProvider();
      return _provider;
    }

    try {
      // Dynamic import to avoid loading OpenAI SDK when not needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OpenAIProvider } = require('./openai-provider') as typeof import('./openai-provider');
      _provider = new OpenAIProvider();
      log(
        'info',
        `Provider: openai (model=${process.env.OPENAI_MODEL || 'gpt-4o-mini'})`
      );
      return _provider;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('warn', `Failed to initialize OpenAI provider: ${message}. Falling back to mock.`);
      _provider = new MockSymptomProvider();
      return _provider;
    }
  }

  // Default: mock
  _provider = new MockSymptomProvider();
  log('info', 'Provider: mock (default — set AI_PROVIDER=openai with OPENAI_API_KEY to enable)');
  return _provider;
}

/**
 * Reset the provider singleton.
 * Used in tests to re-evaluate provider selection.
 */
export function resetProvider(): void {
  _provider = null;
}

// ============================================================
// Dev logger
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', message: string): void {
  if (!isDev) return;
  const prefix = '[AIAnalysis] [ProviderFactory]';
  if (level === 'error') {
    console.error(`${prefix} ❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else {
    console.log(`${prefix} ✅ ${message}`);
  }
}
