'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, X, Smile } from 'lucide-react';

interface EnhancedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileAttach?: (files: File[]) => void;
  onVoiceToggle?: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showVoiceButton?: boolean;
  showAttachButton?: boolean;
  showEmojiButton?: boolean;
}

export function EnhancedInput({
  value,
  onChange,
  onSend,
  onFileAttach,
  onVoiceToggle,
  disabled = false,
  placeholder = 'Type your message...',
  maxLength = 4000,
  showVoiceButton = true,
  showAttachButton = true,
  showEmojiButton = false,
}: EnhancedInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      // Limit to 10MB per file
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
      onFileAttach?.(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.9;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="space-y-2">
      {/* Attached Files */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4">
          {attachedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
            >
              <span className="text-gray-700">{file.name}</span>
              <span className="text-gray-500">
                ({(file.size / 1024).toFixed(1)}KB)
              </span>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div
        className={`relative border rounded-lg transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 bg-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className="w-full px-4 py-3 pr-32 resize-none focus:outline-none bg-transparent"
          style={{
            minHeight: '56px',
            maxHeight: '200px',
          }}
        />

        {/* Character Count */}
        {(isNearLimit || isOverLimit) && (
          <div
            className={`absolute top-2 right-2 text-xs font-medium ${
              isOverLimit ? 'text-red-600' : 'text-yellow-600'
            }`}
          >
            {characterCount}/{maxLength}
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {showAttachButton && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </>
          )}

          {showEmojiButton && (
            <button
              type="button"
              disabled={disabled}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          )}

          {showVoiceButton && (
            <button
              type="button"
              onClick={onVoiceToggle}
              disabled={disabled}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onSend}
            disabled={!value.trim() || disabled || isOverLimit}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-1"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="px-1 flex items-center justify-between text-xs text-gray-500">
        <span>Press Enter to send, Shift+Enter for new line</span>
        {isDragging && (
          <span className="text-primary-600 font-medium">
            Drop files to attach
          </span>
        )}
      </div>
    </div>
  );
}
