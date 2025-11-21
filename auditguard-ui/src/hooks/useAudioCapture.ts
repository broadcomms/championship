'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type InputMode = 'push-to-talk' | 'voice-activation' | 'always-on';

interface AudioCaptureOptions {
  workspaceId: string;
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

export function useAudioCapture(options: AudioCaptureOptions) {
  const {
    workspaceId,
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
  const isRecordingRef = useRef<boolean>(false);

  // Initialize audio context and analyzer
  const initializeAudio = useCallback(async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Edge.');
      }

      // Check if running on HTTPS or localhost
      if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        throw new Error('Microphone access requires HTTPS. Please use a secure connection.');
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Configure MediaRecorder with higher quality settings
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000, // 128 kbps for better quality
      };

      // Fallback to default if preferred type not supported
      const mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType!)
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingDuration = Date.now() - startTimeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        audioChunksRef.current = [];

        console.log('📼 Recording stopped:', {
          duration: `${(recordingDuration / 1000).toFixed(2)}s`,
          size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
          type: audioBlob.type,
        });

        // Check minimum recording duration (0.5 seconds)
        if (recordingDuration < 500) {
          console.warn('⚠️ Recording too short, skipping transcription');
          setState((prev) => ({
            ...prev,
            isRecording: false,
            isProcessing: false,
            error: 'Recording too short. Please hold for at least half a second.',
          }));
          return;
        }

        // Check minimum audio size (5KB)
        if (audioBlob.size < 5000) {
          console.warn('⚠️ Audio file too small, skipping transcription');
          setState((prev) => ({
            ...prev,
            isRecording: false,
            isProcessing: false,
            error: 'Audio file too small. Please speak louder or hold longer.',
          }));
          return;
        }

        setState((prev) => ({ ...prev, isRecording: false, isProcessing: true }));

        // Process audio for transcription
        await processAudioForTranscription(audioBlob);
      };

      return true;
    } catch (error) {
      let errorMessage = 'Failed to initialize audio';
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotFoundError':
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
            break;
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
            break;
          case 'NotReadableError':
            errorMessage = 'Microphone is being used by another application. Please close other apps and try again.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Microphone does not meet the required constraints. Please try a different microphone.';
            break;
          case 'SecurityError':
            errorMessage = 'Security error accessing microphone. Please ensure you are on HTTPS or localhost.';
            break;
          default:
            errorMessage = `Microphone error: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      console.error('Audio capture error:', error);
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
    }
  }, [onError]);

  // Process audio for transcription
  const processAudioForTranscription = useCallback(async (audioBlob: Blob) => {
    try {
      // Convert blob to base64 or send directly to API
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      console.log('🎙️ Sending audio for transcription:', {
        size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
        type: audioBlob.type,
      });

      // Call transcription API with workspaceId and language hint
      const response = await fetch(
        `/api/assistant/transcribe?workspaceId=${workspaceId}&language=en`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${errorText}`);
      }

      const data = await response.json();
      const transcription = data.text || '';

      console.log('✅ Transcription received:', transcription.substring(0, 100));

      onTranscription?.(transcription);
      setState((prev) => ({ ...prev, isProcessing: false, error: null }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      setState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [workspaceId, onTranscription, onError]);

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
    if (isRecordingRef.current || state.isProcessing) return;

    const initialized = mediaRecorderRef.current || (await initializeAudio());
    if (!initialized || !mediaRecorderRef.current) return;

    try {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();
      isRecordingRef.current = true;

      console.log('🎤 Recording started via', inputMode);
      setState((prev) => ({ ...prev, isRecording: true, error: null, duration: 0 }));

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
      }, 1000);

      monitorAudioLevel();
    } catch (error) {
      isRecordingRef.current = false;
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [state.isProcessing, initializeAudio, monitorAudioLevel, onError, inputMode]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) {
      console.log('⏹️ Stop recording called but not recording');
      return;
    }

    try {
      console.log('⏹️ Stopping recording...');
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;

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
      isRecordingRef.current = false;
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [onError]);

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
      // Use ref to avoid stale closure issues
      if (e.code === 'Space' && !e.repeat && !isRecordingRef.current) {
        e.preventDefault();
        console.log('⌨️ Space key DOWN - starting recording');
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Use ref to avoid stale closure issues
      if (e.code === 'Space' && isRecordingRef.current) {
        e.preventDefault();
        console.log('⌨️ Space key UP - stopping recording');
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    console.log('🎹 Keyboard shortcuts registered for push-to-talk');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      console.log('🎹 Keyboard shortcuts unregistered');
    };
  }, [inputMode, startRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
