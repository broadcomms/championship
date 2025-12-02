'use client';

import { useState, useRef, useCallback } from 'react';

export interface VoiceSettings {
  voiceId: string;
  voiceName: string;
  speed: number;
  stability?: number;
  similarityBoost?: number;
  autoPlay: boolean;
}

interface SpeechSynthesisOptions {
  voiceSettings: VoiceSettings;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

interface SpeechSynthesisState {
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
  currentText: string | null;
}

// Available ElevenLabs voices (mapped to actual ElevenLabs voice IDs)
export const AVAILABLE_VOICES = [
  { id: 'rachel', name: 'Rachel', description: 'Clear and professional' },
  { id: 'patrick', name: 'Patrick', description: 'Dynamic resonate' },
  { id: 'bella', name: 'Bella', description: 'Soft and warm' },
  { id: 'domi', name: 'Domi', description: 'Strong and confident' },
  { id: 'arnold', name: 'Arnold', description: 'Crisp and authoritative' },
  { id: 'antoni', name: 'Antoni', description: 'Well-rounded' },
  { id: 'sam', name: 'Sam', description: 'Dynamic and engaging' },
];

/**
 * Clean Markdown formatting from text before sending to TTS
 * Removes: **bold**, *italic*, `code`, [links](url), ### headers, bullet points, etc.
 */
function cleanMarkdownForSpeech(text: string): string {
  return text
    // Remove bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic: *text* or _text_
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code: `code`
    .replace(/`(.+?)`/g, '$1')
    // Remove code blocks: ```code```
    .replace(/```[\s\S]*?```/g, '')
    // Remove links: [text](url) -> text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove headers: ### Header -> Header
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points: - item or * item
    .replace(/^[-*]\s+/gm, '')
    // Remove numbered lists: 1. item
    .replace(/^\d+\.\s+/gm, '')
    // Remove blockquotes: > quote
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules: --- or ***
    .replace(/^[-*_]{3,}$/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function useSpeechSynthesis(options: SpeechSynthesisOptions) {
  const { voiceSettings, onStart, onEnd, onError } = options;

  const [state, setState] = useState<SpeechSynthesisState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
    currentText: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSpeakingRef = useRef(false);
  const lastTextRef = useRef<string | null>(null);
  const lastSpeakTimeRef = useRef<number>(0);

  // Convert text to speech using ElevenLabs API
  const synthesizeSpeech = useCallback(
    async (text: string): Promise<Blob | null> => {
      try {
        // Clean Markdown formatting before sending to TTS
        const cleanedText = cleanMarkdownForSpeech(text);
        
        // TODO: Replace with actual ElevenLabs API endpoint
        const response = await fetch('/api/assistant/synthesize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: cleanedText,
            voice_id: voiceSettings.voiceId,
            voice_settings: {
              stability: voiceSettings.stability || 0.5,
              similarity_boost: voiceSettings.similarityBoost || 0.75,
            },
          }),
        });

        // If server TTS not implemented (501), fall back to browser TTS
        if (response.status === 501) {
          console.log('Server TTS not available, falling back to browser TTS');
          return null; // Signal to use browser fallback
        }

        if (!response.ok) {
          throw new Error('Speech synthesis failed');
        }

        const audioBlob = await response.blob();
        return audioBlob;
      } catch (error) {
        console.warn('Server TTS error, will try browser fallback:', error);
        return null; // Signal to use browser fallback
      }
    },
    [voiceSettings]
  );

  // Play audio from blob
  const playAudio = useCallback(
    async (audioBlob: Blob) => {
      try {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // Apply speed adjustment
        audio.playbackRate = voiceSettings.speed;

        audio.onplay = () => {
          setState((prev) => ({ ...prev, isSpeaking: true, isLoading: false }));
          onStart?.();
        };

        audio.onended = () => {
          isSpeakingRef.current = false;
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            currentText: null,
          }));
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
        };

        audio.onerror = () => {
          isSpeakingRef.current = false;
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            isLoading: false,
            error: 'Audio playback failed',
          }));
          URL.revokeObjectURL(audioUrl);
          onError?.(new Error('Audio playback failed'));
        };

        await audio.play();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Playback failed';
        setState((prev) => ({
          ...prev,
          isSpeaking: false,
          isLoading: false,
          error: errorMessage,
        }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    [voiceSettings.speed, onStart, onEnd, onError]
  );

  // Speak text
  const speak = useCallback(
    async (text: string) => {
      // Prevent duplicate calls within 500ms (React strict mode / multiple instances)
      const now = Date.now();
      if (lastTextRef.current === text && (now - lastSpeakTimeRef.current) < 500) {
        console.log('⏭️ Skipping duplicate speak call for same text within 500ms');
        return;
      }

      // Prevent concurrent speak calls
      if (isSpeakingRef.current) {
        console.log('⏸️ Already speaking, stopping previous...');
        stop();
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      lastTextRef.current = text;
      lastSpeakTimeRef.current = now;
      isSpeakingRef.current = true;

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        currentText: text,
      }));

      try {
        const audioBlob = await synthesizeSpeech(text);

        // If server TTS returned null, use browser TTS fallback
        if (!audioBlob) {
          console.log('Using browser TTS fallback');
          // Clean Markdown formatting for browser TTS too
          const cleanedText = cleanMarkdownForSpeech(text);
          
          // Use browser speech synthesis
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(cleanedText);
            utterance.rate = voiceSettings.speed;
            utterance.onstart = () => {
              setState((prev) => ({ ...prev, isSpeaking: true, isLoading: false }));
              onStart?.();
            };
            utterance.onend = () => {
              isSpeakingRef.current = false;
              setState((prev) => ({ ...prev, isSpeaking: false, currentText: null }));
              onEnd?.();
            };
            utterance.onerror = () => {
              isSpeakingRef.current = false;
              setState((prev) => ({ ...prev, isSpeaking: false, isLoading: false, error: 'Browser TTS failed' }));
              onError?.(new Error('Browser TTS failed'));
            };
            window.speechSynthesis.speak(utterance);
          } else {
            isSpeakingRef.current = false;
            throw new Error('Speech synthesis not supported');
          }
          return;
        }

        if (voiceSettings.autoPlay) {
          await playAudio(audioBlob);
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }
      } catch (error) {
        isSpeakingRef.current = false;
        const errorMessage = error instanceof Error ? error.message : 'Speech synthesis failed';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceSettings.autoPlay, voiceSettings.speed, synthesizeSpeech, playAudio, onStart, onEnd, onError]
  );

  // Stop speaking
  const stop = useCallback(() => {
    // Reset speaking flag
    isSpeakingRef.current = false;

    // Stop audio element if it exists
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Stop browser TTS if it's running
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setState((prev) => ({
      ...prev,
      isSpeaking: false,
      isLoading: false,
      currentText: null,
    }));
  }, []);

  // Pause speaking
  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
  }, []);

  // Resume speaking
  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setState((prev) => ({ ...prev, isSpeaking: true }));
    }
  }, []);

  // Toggle pause/resume
  const togglePause = useCallback(() => {
    if (state.isSpeaking) {
      pause();
    } else if (audioRef.current) {
      resume();
    }
  }, [state.isSpeaking, pause, resume]);

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
    togglePause,
  };
}

// Browser fallback using Web Speech API (for development/testing)
export function useBrowserSpeechSynthesis(voiceSettings: VoiceSettings) {
  const [state, setState] = useState<SpeechSynthesisState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
    currentText: null,
  });

  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) {
        setState((prev) => ({
          ...prev,
          error: 'Speech synthesis not supported',
        }));
        return;
      }

      if (state.isSpeaking) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = voiceSettings.speed;
      
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find((v) => v.name.toLowerCase().includes(voiceSettings.voiceName.toLowerCase()));
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => {
        setState((prev) => ({
          ...prev,
          isSpeaking: true,
          currentText: text,
        }));
      };

      utterance.onend = () => {
        setState((prev) => ({
          ...prev,
          isSpeaking: false,
          currentText: null,
        }));
      };

      utterance.onerror = (event) => {
        setState((prev) => ({
          ...prev,
          isSpeaking: false,
          error: `Speech error: ${event.error}`,
        }));
      };

      window.speechSynthesis.speak(utterance);
    },
    [voiceSettings, state.isSpeaking]
  );

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setState((prev) => ({
      ...prev,
      isSpeaking: false,
      currentText: null,
    }));
  }, []);

  return {
    ...state,
    speak,
    stop,
  };
}
