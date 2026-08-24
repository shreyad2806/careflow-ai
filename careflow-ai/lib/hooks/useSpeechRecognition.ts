/**
 * useSpeechRecognition Hook
 *
 * Wraps the browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * for voice input of symptoms.
 *
 * Features:
 *   - Auto-detects browser support
 *   - Dynamic language switching (en-IN / hi-IN)
 *   - Interim transcript for live feedback
 *   - Final transcript placement into the symptom form
 *   - Graceful error handling for all failure modes
 *
 * Voice data is NEVER stored — only the resulting text transcript
 * is placed into the existing symptom form and sent through
 * the existing /api/ai/symptoms/analyze pipeline.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================
// Types
// ============================================================

export type SpeechLanguage = 'en-IN' | 'hi-IN' | 'en-US' | 'hi';

export type SpeechErrorCode =
  | 'NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'NO_SPEECH'
  | 'NETWORK_ERROR'
  | 'ABORTED'
  | 'UNKNOWN';

export interface SpeechError {
  code: SpeechErrorCode;
  message: string;
}

interface UseSpeechRecognitionOptions {
  /** Language for recognition — maps to BCP 47 tag */
  language?: SpeechLanguage;
  /** Called with the final transcript when recognition ends */
  onResult?: (transcript: string) => void;
  /** Called when recognition encounters an error */
  onError?: (error: SpeechError) => void;
}

interface UseSpeechRecognitionReturn {
  /** Whether the browser supports SpeechRecognition */
  isSupported: boolean;
  /** Whether recognition is currently active */
  isListening: boolean;
  /** Interim (partial) transcript while speaking */
  interimTranscript: string;
  /** Final transcript from the last recognition */
  finalTranscript: string;
  /** Last error, if any */
  error: SpeechError | null;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Abort recognition and clear state */
  reset: () => void;
}

// ============================================================
// Map speech error events to our error type
// ============================================================

function mapSpeechError(error: string): SpeechError {
  switch (error) {
    case 'no-speech':
      return {
        code: 'NO_SPEECH',
        message: 'No speech detected. Please try again and speak clearly.',
      };
    case 'audio-capture':
      return {
        code: 'PERMISSION_DENIED',
        message: 'Microphone not available. Please check your device settings.',
      };
    case 'not-allowed':
      return {
        code: 'PERMISSION_DENIED',
        message: 'Microphone permission denied. Please allow microphone access in your browser settings.',
      };
    case 'network':
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error during speech recognition. Please check your connection.',
      };
    case 'aborted':
      return {
        code: 'ABORTED',
        message: 'Speech recognition was interrupted.',
      };
    default:
      return {
        code: 'UNKNOWN',
        message: `Speech recognition error: ${error}`,
      };
  }
}

// ============================================================
// Hook implementation
// ============================================================

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { language = 'en-IN', onResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStartingRef = useRef(false);

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      const err: SpeechError = {
        code: 'NOT_SUPPORTED',
        message: 'Speech recognition is not supported in this browser. Please type your symptoms.',
      };
      setError(err);
      onError?.(err);
      return;
    }

    if (isStartingRef.current || isListening) return;
    isStartingRef.current = true;

    // Create new recognition instance
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();

    recognition.continuous = true;        // Keep listening until stopped
    recognition.interimResults = true;    // Show live transcript
    recognition.lang = language;          // Dynamic language
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setInterimTranscript('');
      isStartingRef.current = false;
      console.log(`[VoiceInput] 🎤 Started: lang=${language}`);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
      }

      if (final) {
        setFinalTranscript((prev) => {
          const updated = prev ? `${prev} ${final}` : final;
          return updated;
        });
        setInterimTranscript('');
        // Pass final transcript to callback
        onResult?.(final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const err = mapSpeechError(event.error);
      console.error(`[VoiceInput] ❌ Error: ${err.code} — ${err.message}`);
      setError(err);
      onError?.(err);

      if (event.error !== 'aborted') {
        setIsListening(false);
      }
      isStartingRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      isStartingRef.current = false;
      console.log('[VoiceInput] 🎤 Ended');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      // Already started or other error
      const speechErr: SpeechError = {
        code: 'UNKNOWN',
        message: 'Failed to start speech recognition. Please try again.',
      };
      setError(speechErr);
      onError?.(speechErr);
      isStartingRef.current = false;
    }
  }, [isSupported, isListening, language, onResult, onError]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    setIsListening(false);
    setInterimTranscript('');
    isStartingRef.current = false;
  }, []);

  const reset = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
    setFinalTranscript('');
    setError(null);
    isStartingRef.current = false;
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
    reset,
  };
}
