'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type InputMode = 'push-to-talk' | 'voice-activation' | 'always-on';

interface AudioCaptureOptions {
  inputMode?: InputMode;
  voiceActivationThreshold?: number;
  silenceTimeout?: number;
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
}

interface AudioCaptureState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  audioLevel: number;
  duration: number;
}

export function useAudioCapture(options: AudioCaptureOptions = {}) {
  const {
    inputMode = 'push-to-talk',
    voiceActivationThreshold = 0.2,
    silenceTimeout = 2000,
    onTranscription,
    onError,
  } = options;

  const [state, setState] = useState<AudioCaptureState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioLevel: 0,
    duration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context and analyzer
  const initializeAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        setState((prev) => ({ ...prev, isRecording: false, isProcessing: true }));

        // Process audio for transcription
        await processAudioForTranscription(audioBlob);
      };

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize audio';
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
    }
  }, [onError]);

  // Process audio for transcription
  const processAudioForTranscription = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64 or send directly to API
      const formData = new FormData();
      formData.append('audio', audioBlob);

      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/assistant/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcription = data.text || '';

      onTranscription?.(transcription);
      setState((prev) => ({ ...prev, isProcessing: false, error: null }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      setState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  // Monitor audio levels
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      setState((prev) => ({ ...prev, audioLevel: rms }));

      // Voice activation logic
      if (inputMode === 'voice-activation' && state.isRecording) {
        if (rms < voiceActivationThreshold) {
          // Silence detected
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopRecording();
            }, silenceTimeout);
          }
        } else {
          // Voice detected, clear silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [inputMode, voiceActivationThreshold, silenceTimeout, state.isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (state.isRecording || state.isProcessing) return;

    const initialized = mediaRecorderRef.current || (await initializeAudio());
    if (!initialized || !mediaRecorderRef.current) return;

    try {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();

      setState((prev) => ({ ...prev, isRecording: true, error: null, duration: 0 }));

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
      }, 1000);

      monitorAudioLevel();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [state.isRecording, state.isProcessing, initializeAudio, monitorAudioLevel, onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!state.isRecording || !mediaRecorderRef.current) return;

    try {
      mediaRecorderRef.current.stop();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      setState((prev) => ({ ...prev, audioLevel: 0 }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [state.isRecording, onError]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Keyboard shortcuts for push-to-talk
  useEffect(() => {
    if (inputMode !== 'push-to-talk') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !state.isRecording) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && state.isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [inputMode, state.isRecording, startRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
