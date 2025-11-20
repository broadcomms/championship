'use client';

import React, { useState } from 'react';
import { Settings, Volume2, Mic, X } from 'lucide-react';
import { VoiceSettings, AVAILABLE_VOICES } from '@/hooks/useSpeechSynthesis';
import { InputMode } from '@/hooks/useAudioCapture';

interface VoiceSettingsPanelProps {
  voiceSettings: VoiceSettings;
  inputMode: InputMode;
  onVoiceSettingsChange: (settings: VoiceSettings) => void;
  onInputModeChange: (mode: InputMode) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export function VoiceSettingsPanel({
  voiceSettings,
  inputMode,
  onVoiceSettingsChange,
  onInputModeChange,
  onClose,
  isOpen = true,
}: VoiceSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(voiceSettings);
  const [localInputMode, setLocalInputMode] = useState(inputMode);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    onVoiceSettingsChange(localSettings);
    onInputModeChange(localInputMode);
    onClose?.();
  };

  const handleTestVoice = () => {
    setIsTesting(true);
    // TODO: Implement voice testing
    setTimeout(() => setIsTesting(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Voice Settings</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Close settings"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Volume2 className="w-4 h-4" />
              Voice Selection
            </label>
            <div className="space-y-2">
              {AVAILABLE_VOICES.map((voice) => (
                <label
                  key={voice.id}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-300 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="voice"
                    value={voice.id}
                    checked={localSettings.voiceId === voice.id}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        voiceId: e.target.value,
                        voiceName: voice.name,
                      })
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{voice.name}</div>
                    <div className="text-xs text-gray-500">{voice.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Speaking Speed */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Speaking Speed
            </label>
            <div className="space-y-3">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={localSettings.speed}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    speed: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Slow</span>
                <span className="font-medium text-gray-900">
                  {localSettings.speed.toFixed(1)}x
                </span>
                <span>Fast</span>
              </div>
            </div>
          </div>

          {/* Voice Stability (Advanced) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Voice Stability
              <span className="text-xs text-gray-500 ml-2">(Advanced)</span>
            </label>
            <div className="space-y-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localSettings.stability || 0.5}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    stability: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Variable</span>
                <span className="font-medium text-gray-900">
                  {((localSettings.stability || 0.5) * 100).toFixed(0)}%
                </span>
                <span>Stable</span>
              </div>
            </div>
          </div>

          {/* Similarity Boost (Advanced) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Clarity Enhancement
              <span className="text-xs text-gray-500 ml-2">(Advanced)</span>
            </label>
            <div className="space-y-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localSettings.similarityBoost || 0.75}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    similarityBoost: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Low</span>
                <span className="font-medium text-gray-900">
                  {((localSettings.similarityBoost || 0.75) * 100).toFixed(0)}%
                </span>
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Input Mode */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Mic className="w-4 h-4" />
              Input Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-300 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="inputMode"
                  value="push-to-talk"
                  checked={localInputMode === 'push-to-talk'}
                  onChange={(e) => setLocalInputMode(e.target.value as InputMode)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    Push to Talk (Hold Space)
                  </div>
                  <div className="text-xs text-gray-500">
                    Press and hold Space key to record
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-300 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="inputMode"
                  value="voice-activation"
                  checked={localInputMode === 'voice-activation'}
                  onChange={(e) => setLocalInputMode(e.target.value as InputMode)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">Voice Activation</div>
                  <div className="text-xs text-gray-500">
                    Automatically detect when you speak
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-300 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="inputMode"
                  value="always-on"
                  checked={localInputMode === 'always-on'}
                  onChange={(e) => setLocalInputMode(e.target.value as InputMode)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">Always On</div>
                  <div className="text-xs text-gray-500">
                    Continuously record until stopped
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3 pt-3 border-t border-gray-200">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Auto-play Responses
              </span>
              <button
                onClick={() =>
                  setLocalSettings({
                    ...localSettings,
                    autoPlay: !localSettings.autoPlay,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localSettings.autoPlay ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.autoPlay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <p className="text-xs text-gray-500">
              Automatically play AI responses using text-to-speech
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleTestVoice}
            disabled={isTesting}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test Voice'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact inline voice controls
interface VoiceControlsProps {
  isRecording: boolean;
  isSpeaking: boolean;
  onToggleRecording: () => void;
  onToggleSpeaking: () => void;
  onOpenSettings: () => void;
}

export function VoiceControls({
  isRecording,
  isSpeaking,
  onToggleRecording,
  onToggleSpeaking,
  onOpenSettings,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleRecording}
        className={`p-2 rounded-lg transition-colors ${
          isRecording
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
      </button>

      <button
        onClick={onToggleSpeaking}
        className={`p-2 rounded-lg transition-colors ${
          isSpeaking
            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title={isSpeaking ? 'Stop speaking' : 'Play response'}
      >
        <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
      </button>

      <button
        onClick={onOpenSettings}
        className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        title="Voice settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}
