'use client';

import React from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface TranscriptionDisplayProps {
  text: string;
  isTranscribing: boolean;
  error?: string | null;
  confidence?: number;
  language?: string;
  onEdit?: (text: string) => void;
  onConfirm?: (text: string) => void;
  showActions?: boolean;
}

export function TranscriptionDisplay({
  text,
  isTranscribing,
  error,
  confidence,
  language = 'en',
  onEdit,
  onConfirm,
  showActions = true,
}: TranscriptionDisplayProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedText, setEditedText] = React.useState(text);

  React.useEffect(() => {
    setEditedText(text);
  }, [text]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    onEdit?.(editedText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(text);
    setIsEditing(false);
  };

  const handleConfirm = () => {
    onConfirm?.(editedText);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-900">Transcription Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isTranscribing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          <div className="flex-1">
            <p className="text-sm text-blue-900">Transcribing audio...</p>
            {text && (
              <p className="text-sm text-blue-700 mt-2 italic">"{text}"</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!text) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-xs font-medium text-gray-700">Transcription</span>
          {confidence !== undefined && (
            <span className="text-xs text-gray-500">
              ({Math.round(confidence * 100)}% confidence)
            </span>
          )}
        </div>
        {language && language !== 'en' && (
          <span className="text-xs px-2 py-0.5 bg-gray-200 rounded text-gray-600">
            {language.toUpperCase()}
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full min-h-[80px] p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{text}</p>
          {showActions && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEdit}
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors"
              >
                Send as Message
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface LiveTranscriptionProps {
  text: string;
  isActive: boolean;
}

export function LiveTranscription({ text, isActive }: LiveTranscriptionProps) {
  return (
    <div
      className={`transition-all duration-300 ${
        isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
      }`}
    >
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75" />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150" />
          </div>
          <span className="text-xs font-medium text-blue-900">Live Transcription</span>
        </div>
        <p className="text-sm text-gray-900 min-h-[20px]">
          {text || <span className="text-gray-400 italic">Listening...</span>}
        </p>
      </div>
    </div>
  );
}
