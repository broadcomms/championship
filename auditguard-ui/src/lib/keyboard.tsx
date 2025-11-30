/**
 * Keyboard Shortcuts Manager
 * Centralized keyboard shortcut handling with accessibility
 */

'use client';

import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

export interface ShortcutGroup {
  name: string;
  shortcuts: KeyboardShortcut[];
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcut(shortcut: KeyboardShortcut): void {
  const shortcutRef = useRef(shortcut);

  useEffect(() => {
    shortcutRef.current = shortcut;
  }, [shortcut]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrl, meta, shift, alt, handler, preventDefault = true } = shortcutRef.current;

      // Check if all modifiers match
      const ctrlMatch = ctrl === undefined || event.ctrlKey === ctrl;
      const metaMatch = meta === undefined || event.metaKey === meta;
      const shiftMatch = shift === undefined || event.shiftKey === shift;
      const altMatch = alt === undefined || event.altKey === alt;

      // Check if key matches (case-insensitive)
      const keyMatch = event.key.toLowerCase() === key.toLowerCase();

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/**
 * Hook to register multiple keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        const { key, ctrl, meta, shift, alt, handler, preventDefault = true } = shortcut;

        const ctrlMatch = ctrl === undefined || event.ctrlKey === ctrl;
        const metaMatch = meta === undefined || event.metaKey === meta;
        const shiftMatch = shift === undefined || event.shiftKey === shift;
        const altMatch = alt === undefined || event.altKey === alt;
        const keyMatch = event.key.toLowerCase() === key.toLowerCase();

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (preventDefault) {
            event.preventDefault();
          }
          handler(event);
          break; // Only execute the first matching shortcut
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/**
 * Global keyboard shortcuts for the application
 */
export const GLOBAL_SHORTCUTS: ShortcutGroup[] = [
  {
    name: 'Navigation',
    shortcuts: [
      {
        key: 'k',
        ctrl: true,
        description: 'Open AI Assistant',
        handler: () => {
          // Navigate to assistant
          window.location.href = '/assistant';
        },
      },
      {
        key: 'n',
        ctrl: true,
        description: 'New Conversation',
        handler: () => {
          // Trigger new conversation
          const event = new CustomEvent('newConversation');
          window.dispatchEvent(event);
        },
      },
      {
        key: '/',
        ctrl: true,
        description: 'Search',
        handler: () => {
          const event = new CustomEvent('openSearch');
          window.dispatchEvent(event);
        },
      },
    ],
  },
  {
    name: 'Chat',
    shortcuts: [
      {
        key: 'Enter',
        description: 'Send Message',
        handler: () => {
          const event = new CustomEvent('sendMessage');
          window.dispatchEvent(event);
        },
        preventDefault: false, // Let form handle it
      },
      {
        key: 'Enter',
        shift: true,
        description: 'New Line',
        handler: () => {
          // Handled by textarea natively
        },
        preventDefault: false,
      },
      {
        key: 'e',
        ctrl: true,
        description: 'Export Conversation',
        handler: () => {
          const event = new CustomEvent('exportConversation');
          window.dispatchEvent(event);
        },
      },
      {
        key: ' ',
        description: 'Voice Input (Hold)',
        handler: () => {
          const event = new CustomEvent('voiceInputStart');
          window.dispatchEvent(event);
        },
        preventDefault: false,
      },
      {
        key: 'Escape',
        description: 'Cancel/Close',
        handler: () => {
          const event = new CustomEvent('cancel');
          window.dispatchEvent(event);
        },
      },
    ],
  },
  {
    name: 'Conversation Management',
    shortcuts: [
      {
        key: 'ArrowUp',
        ctrl: true,
        description: 'Previous Conversation',
        handler: () => {
          const event = new CustomEvent('previousConversation');
          window.dispatchEvent(event);
        },
      },
      {
        key: 'ArrowDown',
        ctrl: true,
        description: 'Next Conversation',
        handler: () => {
          const event = new CustomEvent('nextConversation');
          window.dispatchEvent(event);
        },
      },
      {
        key: 'p',
        ctrl: true,
        shift: true,
        description: 'Pin Conversation',
        handler: () => {
          const event = new CustomEvent('pinConversation');
          window.dispatchEvent(event);
        },
      },
      {
        key: 'a',
        ctrl: true,
        shift: true,
        description: 'Archive Conversation',
        handler: () => {
          const event = new CustomEvent('archiveConversation');
          window.dispatchEvent(event);
        },
      },
    ],
  },
  {
    name: 'Interface',
    shortcuts: [
      {
        key: '1',
        ctrl: true,
        description: 'Switch to Chat Tab',
        handler: () => {
          const event = new CustomEvent('switchTab', { detail: 'chat' });
          window.dispatchEvent(event);
        },
      },
      {
        key: '2',
        ctrl: true,
        description: 'Switch to Analytics Tab',
        handler: () => {
          const event = new CustomEvent('switchTab', { detail: 'analytics' });
          window.dispatchEvent(event);
        },
      },
      {
        key: '3',
        ctrl: true,
        description: 'Switch to Settings Tab',
        handler: () => {
          const event = new CustomEvent('switchTab', { detail: 'settings' });
          window.dispatchEvent(event);
        },
      },
      {
        key: '?',
        shift: true,
        description: 'Show Keyboard Shortcuts',
        handler: () => {
          const event = new CustomEvent('showShortcuts');
          window.dispatchEvent(event);
        },
      },
    ],
  },
];

/**
 * Keyboard Shortcuts Help Modal Component
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto m-4 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {GLOBAL_SHORTCUTS.map((group) => (
            <div key={group.name}>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{group.name}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.ctrl && <kbd className="kbd">Ctrl</kbd>}
                      {shortcut.meta && <kbd className="kbd">⌘</kbd>}
                      {shortcut.shift && <kbd className="kbd">Shift</kbd>}
                      {shortcut.alt && <kbd className="kbd">Alt</kbd>}
                      <kbd className="kbd">{formatKey(shortcut.key)}</kbd>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500 text-center">
            Press <kbd className="kbd">?</kbd> to toggle this help
          </p>
        </div>
      </div>

      <style jsx>{`
        .kbd {
          display: inline-block;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.5;
          color: #374151;
          background-color: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  );
}

/**
 * Format key for display
 */
function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Escape': 'Esc',
  };

  return keyMap[key] || key.toUpperCase();
}

/**
 * Hook to show keyboard shortcuts help
 */
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleShowShortcuts = () => setIsOpen(true);
    window.addEventListener('showShortcuts', handleShowShortcuts);
    return () => window.removeEventListener('showShortcuts', handleShowShortcuts);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

import { useState } from 'react';
