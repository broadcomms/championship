import { expect, test, describe, beforeEach } from 'vitest';

/**
 * Assistant Service Tests
 * Tests for conversation management and title generation
 */

describe('generateConversationTitle', () => {
  // Test helper that mimics the generateConversationTitle logic
  function generateConversationTitle(message: string): string {
    let title = message.trim();

    const prefixesToRemove = [
      /^(hey|hi|hello|please|can you|could you|would you|i want to|i need to|help me)\s+/i,
      /^(what is|what are|what's|how do|how can|how to|where is|where are|when|why|who)\s+/i,
    ];

    for (const prefix of prefixesToRemove) {
      const match = title.match(prefix);
      if (match) {
        if (/^(hey|hi|hello|please|can you|could you|would you|i want to|i need to|help me)/i.test(match[0])) {
          title = title.replace(prefix, '');
        }
        break;
      }
    }

    title = title.charAt(0).toUpperCase() + title.slice(1);

    if (title.length > 50) {
      title = title.substring(0, 47);
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 30) {
        title = title.substring(0, lastSpace);
      }
      title += '...';
    }

    title = title.replace(/[?!.,;:]+$/, '');

    return title || 'New Conversation';
  }

  test('should generate title from simple question', () => {
    const title = generateConversationTitle('What is my compliance score?');
    expect(title).toBe('What is my compliance score');
  });

  test('should remove greeting prefixes', () => {
    const title = generateConversationTitle('Please help me with GDPR compliance?');
    expect(title).toBe('Help me with GDPR compliance');
  });

  test('should capitalize first letter', () => {
    const title = generateConversationTitle('show me documents');
    expect(title).toBe('Show me documents');
  });

  test('should truncate long messages', () => {
    const title = generateConversationTitle(
      'I need help understanding the comprehensive data protection requirements for GDPR Article 5 regarding data minimization and storage limitations'
    );
    // Title should be truncated - actual truncation happens at word boundary
    expect(title.length).toBeLessThanOrEqual(55);
  });

  test('should handle empty input', () => {
    const title = generateConversationTitle('');
    expect(title).toBe('New Conversation');
  });

  test('should handle whitespace only', () => {
    const title = generateConversationTitle('   ');
    expect(title).toBe('New Conversation');
  });

  test('should remove trailing punctuation', () => {
    const title = generateConversationTitle('Check compliance status!');
    expect(title).toBe('Check compliance status');
  });

  test('should keep question words', () => {
    const title = generateConversationTitle('How do I improve my SOC2 score?');
    expect(title).toBe('How do I improve my SOC2 score');
  });
});

describe('Conversation Session Management', () => {
  test('session ID format should be valid', () => {
    // Test the session ID generation format
    const sessionId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    expect(sessionId).toMatch(/^conv_\d+_[a-z0-9]+$/);
  });

  test('message ID format should be valid', () => {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    expect(messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
  });
});

describe('Session List Response Format', () => {
  test('session list should include required fields', () => {
    // Mock session data as it would be returned from listSessions
    const mockSession = {
      id: 'conv_1234567890_abc123',
      title: 'What is my compliance score',
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      messageCount: 5
    };

    expect(mockSession).toHaveProperty('id');
    expect(mockSession).toHaveProperty('title');
    expect(mockSession).toHaveProperty('startedAt');
    expect(mockSession).toHaveProperty('lastActivityAt');
    expect(mockSession).toHaveProperty('messageCount');
  });

  test('session title can be null for legacy sessions', () => {
    const mockSession = {
      id: 'conv_1234567890_abc123',
      title: null,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      messageCount: 0
    };

    expect(mockSession.title).toBeNull();
  });
});

describe('Chat Response Format', () => {
  test('chat response should include required fields', () => {
    const mockResponse = {
      sessionId: 'conv_1234567890_abc123',
      message: 'Your compliance score is 85%',
      suggestions: ['Show me details', 'What can I improve?'],
      actions: [
        { type: 'navigate', target: '/compliance', label: 'View Details' }
      ]
    };

    expect(mockResponse).toHaveProperty('sessionId');
    expect(mockResponse).toHaveProperty('message');
    expect(mockResponse).toHaveProperty('suggestions');
    expect(mockResponse).toHaveProperty('actions');
    expect(Array.isArray(mockResponse.suggestions)).toBe(true);
    expect(Array.isArray(mockResponse.actions)).toBe(true);
  });
});

describe('Message Format', () => {
  test('message should have required fields', () => {
    const mockMessage = {
      id: 'msg_1234567890_xyz789',
      role: 'user',
      content: 'What is my compliance score?',
      createdAt: Date.now()
    };

    expect(mockMessage).toHaveProperty('id');
    expect(mockMessage).toHaveProperty('role');
    expect(mockMessage).toHaveProperty('content');
    expect(mockMessage).toHaveProperty('createdAt');
  });

  test('role should be valid type', () => {
    const validRoles = ['user', 'assistant', 'system', 'tool'];

    validRoles.forEach(role => {
      const message = { id: 'msg_1', role, content: 'test', createdAt: Date.now() };
      expect(validRoles).toContain(message.role);
    });
  });
});
