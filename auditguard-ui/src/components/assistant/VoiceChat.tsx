'use client';

import React, { useState } from 'react';
import { Mic, Square, Loader2, Volume2, Settings } from 'lucide-react';
import { useAudioCapture, InputMode } from '@/hooks/useAudioCapture';
import { useSpeechSynthesis, VoiceSettings } from '@/hooks/useSpeechSynthesis';
import { VoiceVisualizer, WaveformVisualizer } from './VoiceVisualizer';
import { TranscriptionDisplay, LiveTranscription } from './TranscriptionDisplay';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

interface VoiceChatProps {
  workspaceId: string;
  onTranscription: (text: string) => void;
  onSendMessage?: (text: string) => void;
  lastAssistantMessage?: string;
}

export function VoiceChat({ workspaceId, onTranscription, onSendMessage, lastAssistantMessage }: VoiceChatProps) {
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');

  // Voice settings state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceId: 'rachel',
    voiceName: 'Rachel',
    speed: 1.0,
    stability: 0.5,
    similarityBoost: 0.75,
    autoPlay: true,
  });

  const [inputMode, setInputMode] = useState<InputMode>('push-to-talk');

  // Audio capture hook
  const audioCapture = useAudioCapture({
    workspaceId,
    inputMode,
    voiceActivationThreshold: 0.2,
    silenceTimeout: 2000,
    onTranscription: (text) => {
      setTranscribedText(text);
      setLiveTranscript('');
      onTranscription(text);
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

  // Auto-play assistant responses
  React.useEffect(() => {
    if (lastAssistantMessage && voiceSettings.autoPlay && isVoiceModeActive) {
      speechSynthesis.speak(lastAssistantMessage);
    }
  }, [lastAssistantMessage, voiceSettings.autoPlay, isVoiceModeActive]);

  const handleToggleVoiceMode = () => {
    setIsVoiceModeActive(!isVoiceModeActive);
    if (isVoiceModeActive) {
      audioCapture.stopRecording();
      speechSynthesis.stop();
    }
  };

  const handleSendTranscription = (text: string) => {
    onSendMessage?.(text);
    setTranscribedText('');
  };

  if (!isVoiceModeActive) {
    return (
      <button
        onClick={handleToggleVoiceMode}
        className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl transition-all shadow-md hover:shadow-lg"
        title="Enable voice mode"
        aria-label="Enable voice mode"
      >
        <Mic className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${audioCapture.isRecording ? 'bg-red-100' : 'bg-primary-100'}`}>
                <Mic className={`w-6 h-6 ${audioCapture.isRecording ? 'text-red-600' : 'text-primary-600'}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Voice Mode</h2>
                <p className="text-sm text-gray-500">
                  {audioCapture.isRecording
                    ? 'Recording...'
                    : audioCapture.isProcessing
                    ? 'Processing...'
                    : 'Ready to listen'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Voice settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Visualization */}
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            {/* Error Display */}
            {audioCapture.error && (
              <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 text-red-600 mt-0.5">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800 mb-1">Microphone Error</h3>
                    <p className="text-sm text-red-700">{audioCapture.error}</p>
                    <button
                      onClick={() => {
                        audioCapture.toggleRecording();
                      }}
                      className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium underline"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            <WaveformVisualizer
              audioLevel={audioCapture.audioLevel}
              isActive={audioCapture.isRecording}
              size={180}
            />

            <VoiceVisualizer
              audioLevel={audioCapture.audioLevel}
              isRecording={audioCapture.isRecording}
              isProcessing={audioCapture.isProcessing}
              width={300}
              height={60}
            />

            {audioCapture.duration > 0 && (
              <div className="text-2xl font-mono text-gray-900">
                {Math.floor(audioCapture.duration / 60)}:{(audioCapture.duration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Live Transcription */}
          <LiveTranscription
            text={liveTranscript}
            isActive={audioCapture.isRecording}
          />

          {/* Transcription Display */}
          {transcribedText && (
            <TranscriptionDisplay
              text={transcribedText}
              isTranscribing={audioCapture.isProcessing}
              error={audioCapture.error}
              onEdit={setTranscribedText}
              onConfirm={handleSendTranscription}
            />
          )}

          {/* Controls */}
          <div className="space-y-4">
            {/* Recording Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={audioCapture.toggleRecording}
                disabled={audioCapture.isProcessing}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                  audioCapture.isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {audioCapture.isRecording ? (
                  <>
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </>
                ) : audioCapture.isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </>
                )}
              </button>

              {speechSynthesis.isSpeaking && (
                <button
                  onClick={speechSynthesis.stop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all"
                >
                  <Volume2 className="w-5 h-5" />
                  Stop Speaking
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="text-center text-sm text-gray-600">
              {inputMode === 'push-to-talk' && !audioCapture.error && (
                <p>Hold <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">SPACE</kbd> to talk</p>
              )}
              {inputMode === 'voice-activation' && !audioCapture.error && (
                <p>Speak naturally - voice activation is on</p>
              )}
              {inputMode === 'always-on' && !audioCapture.error && (
                <p>Continuous recording - click Stop when done</p>
              )}
            </div>


          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleToggleVoiceMode}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Exit Voice Mode
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <VoiceSettingsPanel
        voiceSettings={voiceSettings}
        inputMode={inputMode}
        onVoiceSettingsChange={setVoiceSettings}
        onInputModeChange={setInputMode}
        onClose={() => setShowSettings(false)}
        isOpen={showSettings}
      />
    </>
  );
}
