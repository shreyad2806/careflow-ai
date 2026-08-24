/**
 * Provider factory — selects the appropriate AI provider based on environment.
 *
 * Selection logic:
 *   1. If AI_PROVIDER=mock → MockSymptomProvider (default, always works)
 *   2. If AI_PROVIDER=openai + OPENAI_API_KEY → OpenAIProvider
 *   3. If AI_PROVIDER=gemini + GEMINI_API_KEY → GeminiSymptomProvider
 *   4. If AI_PROVIDER=openai but no OPENAI_API_KEY → falls back to mock + warning
 *   5. If AI_PROVIDER=gemini but no GEMINI_API_KEY → falls back to mock + warning
 *   6. If AI_PROVIDER unset + a key exists for any provider → use that provider
 *   7. If AI_PROVIDER unset + no keys → mock
 *
 * This keeps the mock provider always available for development and testing,
 * while allowing a seamless switch to real providers when credentials are configured.
 *
 * Environment variables:
 *   AI_PROVIDER       — 'mock' | 'openai' | 'gemini' (default: auto-detect)
 *   OPENAI_API_KEY    — Required for OpenAI provider
 *   OPENAI_MODEL      — Optional, defaults to 'gpt-4o-mini'
 *   GEMINI_API_KEY    — Required for Gemini provider
 *   GEMINI_MODEL      — Optional, defaults to 'gemini-3.6-flash'
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
 *   - AI_PROVIDER=gemini + GEMINI_API_KEY → Gemini
 *   - AI_PROVIDER=gemini + no key → mock (with warning)
 *   - AI_PROVIDER unset + OPENAI_API_KEY → OpenAI
 *   - AI_PROVIDER unset + GEMINI_API_KEY → Gemini
 *   - AI_PROVIDER unset + no keys → mock
 */
export function getProvider(): SymptomAIProvider {
  if (_provider) return _provider;

  const configuredProvider = process.env.AI_PROVIDER?.toLowerCase();
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  // Explicit mock
  if (configuredProvider === 'mock') {
    _provider = new MockSymptomProvider();
    log('info', 'Provider: mock (explicitly configured via AI_PROVIDER=mock)');
    return _provider;
  }

  // Explicit openai
  if (configuredProvider === 'openai') {
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

  // Explicit gemini
  if (configuredProvider === 'gemini') {
    if (!hasGeminiKey) {
      log(
        'warn',
        'AI_PROVIDER=gemini but GEMINI_API_KEY is not set. Falling back to mock.'
      );
      _provider = new MockSymptomProvider();
      return _provider;
    }

    try {
      // Dynamic import to avoid loading Gemini SDK when not needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GeminiSymptomProvider } = require('./gemini-provider') as typeof import('./gemini-provider');
      _provider = new GeminiSymptomProvider();
      log(
        'info',
        `Provider: gemini (model=${process.env.GEMINI_MODEL || 'gemini-3.6-flash'})`
      );
      return _provider;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('warn', `Failed to initialize Gemini provider: ${message}. Falling back to mock.`);
      _provider = new MockSymptomProvider();
      return _provider;
    }
  }

  // Auto-detect: prefer the first provider with a configured key
  if (!configuredProvider) {
    // Try OpenAI first
    if (hasOpenAIKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { OpenAIProvider } = require('./openai-provider') as typeof import('./openai-provider');
        _provider = new OpenAIProvider();
        log(
          'info',
          `Provider: openai (auto-detected, model=${process.env.OPENAI_MODEL || 'gpt-4o-mini'})`
        );
        return _provider;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('warn', `Failed to initialize OpenAI provider: ${message}. Trying Gemini.`);
      }
    }

    // Try Gemini
    if (hasGeminiKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { GeminiSymptomProvider } = require('./gemini-provider') as typeof import('./gemini-provider');
        _provider = new GeminiSymptomProvider();
        log(
          'info',
          `Provider: gemini (auto-detected, model=${process.env.GEMINI_MODEL || 'gemini-3.6-flash'})`
        );
        return _provider;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('warn', `Failed to initialize Gemini provider: ${message}. Falling back to mock.`);
      }
    }
  }

  // Default: mock
  _provider = new MockSymptomProvider();
  log('info', 'Provider: mock (default — set AI_PROVIDER=openai|gemini with the corresponding API key to enable)');
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
