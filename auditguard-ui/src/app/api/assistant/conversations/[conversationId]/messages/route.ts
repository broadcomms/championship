import { NextRequest, NextResponse } from 'next/server';
import type { Message } from '@/types/assistant';

/**
 * GET /api/assistant/conversations/[conversationId]/messages
 * Get all messages for a specific conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { conversationId } = params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual database query
    // For now, return mock messages
    const mockMessages: Message[] = [
      {
        id: 'msg_1',
        role: 'user',
        content: 'What are the GDPR data breach notification requirements?',
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: 'msg_2',
        role: 'assistant',
        content: `Under GDPR Article 33, organizations must notify the supervisory authority within 72 hours of becoming aware of a breach.

Key requirements include:
• Nature of the breach
• Categories of data affected
• Likely consequences
• Measures taken to address the breach

Would you like more details about any specific aspect?`,
        timestamp: new Date(Date.now() - 3540000),
        actions: [
          {
            type: 'navigate',
            label: 'View GDPR Guide',
            target: '/compliance/gdpr',
          },
          {
            type: 'export',
            label: 'Export Requirements',
          },
        ],
      },
      {
        id: 'msg_3',
        role: 'user',
        content: 'When do we need to notify affected individuals?',
        timestamp: new Date(Date.now() - 3480000),
      },
      {
        id: 'msg_4',
        role: 'assistant',
        content: `Under GDPR Article 34, you must notify affected individuals "without undue delay" when the breach is likely to result in a high risk to their rights and freedoms.

However, notification is NOT required if:
1. You've implemented appropriate technical and organizational measures (e.g., encryption)
2. You've taken subsequent measures ensuring the high risk is no longer likely
3. It would involve disproportionate effort (in which case, make a public communication)

The notification to individuals should be in clear, plain language and include:
• Nature of the breach
• Contact point for more information
• Likely consequences
• Measures taken or proposed`,
        timestamp: new Date(Date.now() - 3420000),
      },
    ];

    return NextResponse.json({
      messages: mockMessages,
      sessionId: `session_${conversationId}`,
      conversationId,
    });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
