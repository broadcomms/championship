'use client';

import React, { useState, useEffect } from 'react';
import { Mic, Square, Loader2, Edit2, Send, Settings } from 'lucide-react';
import { useAudioCapture, InputMode } from '@/hooks/useAudioCapture';
import { useSpeechSynthesis, VoiceSettings } from '@/hooks/useSpeechSynthesis';
import { WaveformVisualizer } from './VoiceVisualizer';

interface VoiceInputPanelProps {
  workspaceId: string;
  onSendTranscription: (text: string) => void;
  voiceSettings: VoiceSettings;
  inputMode: InputMode;
  onSettingsClick: () => void;
  lastAssistantMessage?: string;
  className?: string;
}

export function VoiceInputPanel({
  workspaceId,
  onSendTranscription,
  voiceSettings,
  inputMode,
  onSettingsClick,
  lastAssistantMessage,
  className = '',
}: VoiceInputPanelProps) {
  const [transcribedText, setTranscribedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Debug: Log component mount
  React.useEffect(() => {
    const instanceId = Math.random().toString(36).substring(7);
    console.log(`🎤 VoiceInputPanel [${instanceId}] mounted`);
    return () => {
      console.log(`🎤 VoiceInputPanel [${instanceId}] unmounted`);
    };
  }, []);

  // Audio capture hook
  const audioCapture = useAudioCapture({
    workspaceId,
    inputMode,
    voiceActivationThreshold: 0.2,
    silenceTimeout: 2000,
    onTranscription: (text) => {
      setTranscribedText(text);
      // Auto-send in push-to-talk mode (space bar release)
      if (inputMode === 'push-to-talk' && text.trim()) {
        onSendTranscription(text);
        setTranscribedText('');
      }
    },
    onError: (error) => {
      console.error('Audio capture error:', error);
    },
  });

  // Speech synthesis hook
  const speechSynthesis = useSpeechSynthesis({
    voiceSettings,
    onStart: () => {
      console.log('Speech started');
    },
    onEnd: () => {
      console.log('Speech ended');
    },
    onError: (error) => {
      console.error('Speech synthesis error:', error);
    },
  });

  // Initialize: mark current message as already spoken (don't replay old messages)
  useEffect(() => {
    if (!isInitialized && lastAssistantMessage) {
      console.log('🎤 VoiceInputPanel initialized - marking current message as spoken (no replay)');
      setLastSpokenMessage(lastAssistantMessage);
      setIsInitialized(true);
    } else if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized, lastAssistantMessage]);

  // Auto-play NEW assistant responses only (messages that arrive AFTER voice mode is active)
  useEffect(() => {
    if (!isInitialized) return; // Wait for initialization

    if (lastAssistantMessage && voiceSettings.autoPlay && lastAssistantMessage !== lastSpokenMessage) {
      console.log('🔊 Speaking NEW message:', lastAssistantMessage.substring(0, 50));
      speechSynthesis.speak(lastAssistantMessage);
      setLastSpokenMessage(lastAssistantMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssistantMessage, voiceSettings.autoPlay, lastSpokenMessage, isInitialized]);

  // Cleanup: stop speech when component unmounts
  useEffect(() => {
    return () => {
      console.log('VoiceInputPanel unmounting - stopping speech');
      speechSynthesis.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount

  const handleSend = () => {
    if (transcribedText.trim()) {
      onSendTranscription(transcribedText);
      setTranscribedText('');
      setIsEditing(false);
    }
  };

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {/* Voice Visualization Area */}
      <div className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
        {/* Error Display */}
        {audioCapture.error && (
          <div className="w-full px-4 mb-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-red-600 text-sm flex-1">
                  <span className="font-medium">Microphone Error:</span> {audioCapture.error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Waveform Visualization */}
        <div className="mb-4">
          <WaveformVisualizer
            audioLevel={audioCapture.audioLevel}
            isActive={audioCapture.isRecording}
            size={120}
          />
        </div>

        {/* Recording Status */}
        <div className="text-center space-y-1">
          <p className={`text-sm font-medium ${
            audioCapture.isRecording ? 'text-red-600' : 
            audioCapture.isProcessing ? 'text-blue-600' : 
            'text-gray-600'
          }`}>
            {audioCapture.isRecording
              ? '🎤 Recording...'
              : audioCapture.isProcessing
              ? '⏳ Processing...'
              : '✓ Ready'}
          </p>
          
          {audioCapture.duration > 0 && audioCapture.isRecording && (
            <p className="text-xs font-mono text-gray-500">
              {Math.floor(audioCapture.duration / 60)}:{(audioCapture.duration % 60).toString().padStart(2, '0')}
            </p>
          )}
        </div>

        {/* Audio Level Indicator */}
        {audioCapture.isRecording && (
          <div className="mt-3 w-48">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-100"
                style={{ width: `${audioCapture.audioLevel * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={audioCapture.toggleRecording}
          disabled={audioCapture.isProcessing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
            audioCapture.isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {audioCapture.isRecording ? (
            <>
              <Square className="w-4 h-4" />
              Stop
            </>
          ) : audioCapture.isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Record
            </>
          )}
        </button>

        <button
          onClick={onSettingsClick}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Voice settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Transcription Display & Edit */}
      {transcribedText && (
        <div className="space-y-2">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                rows={3}
                placeholder="Edit transcription..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-900 mb-3">{transcribedText}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-white rounded-lg transition-colors flex items-center justify-center gap-1 border"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!audioCapture.error && !transcribedText && (
        <div className="text-center text-xs text-gray-500">
          {inputMode === 'push-to-talk' && (
            <p>Click Record or hold <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">SPACE</kbd> to talk</p>
          )}
          {inputMode === 'voice-activation' && (
            <p>Voice activation is on - speak naturally</p>
          )}
          {inputMode === 'always-on' && (
            <p>Continuous recording - click Stop when done</p>
          )}
        </div>
      )}
    </div>
  );
}
