import { NextRequest, NextResponse } from 'next/server';
import type { Conversation, FilterOptions } from '@/types/assistant';

/**
 * GET /api/assistant/conversations
 * List all conversations for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual database query
    // For now, return mock data
    const mockConversations: Conversation[] = [
      {
        id: 'conv_1',
        title: 'GDPR Compliance Review',
        lastMessage: 'The requirements include data processing records...',
        lastMessageTime: new Date(),
        messageCount: 24,
        status: 'active',
        isPinned: true,
        isArchived: false,
        isUnread: false,
        tags: ['GDPR', 'urgent'],
        frameworks: ['GDPR'],
        completionPercentage: 85,
      },
      {
        id: 'conv_2',
        title: 'SOC2 Audit Preparation',
        lastMessage: 'You need to update your security policies...',
        lastMessageTime: new Date(Date.now() - 86400000), // Yesterday
        messageCount: 18,
        status: 'in-progress',
        isPinned: false,
        isArchived: false,
        isUnread: true,
        tags: ['SOC2', 'audit'],
        frameworks: ['SOC2'],
        completionPercentage: 60,
      },
    ];

    return NextResponse.json({
      conversations: mockConversations,
      hasMore: false,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assistant/conversations
 * List conversations with filters, pagination, and sorting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, filters, page = 1, limit = 20 } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual database query with filters
    // For now, return filtered mock data
    const mockConversations: Conversation[] = [
      {
        id: 'conv_1',
        title: 'GDPR Compliance Review',
        lastMessage: 'The requirements include data processing records...',
        lastMessageTime: new Date(),
        messageCount: 24,
        status: 'active',
        isPinned: true,
        isArchived: false,
        isUnread: false,
        tags: ['GDPR', 'urgent'],
        frameworks: ['GDPR'],
        completionPercentage: 85,
      },
      {
        id: 'conv_2',
        title: 'SOC2 Audit Preparation',
        lastMessage: 'You need to update your security policies...',
        lastMessageTime: new Date(Date.now() - 86400000),
        messageCount: 18,
        status: 'in-progress',
        isPinned: false,
        isArchived: false,
        isUnread: true,
        tags: ['SOC2', 'audit'],
        frameworks: ['SOC2'],
        completionPercentage: 60,
      },
      {
        id: 'conv_3',
        title: 'ISO 27001 Checklist',
        lastMessage: 'All items are complete and ready for review',
        lastMessageTime: new Date(Date.now() - 604800000), // 1 week ago
        messageCount: 32,
        status: 'complete',
        isPinned: false,
        isArchived: false,
        isUnread: false,
        tags: ['ISO27001', 'complete'],
        frameworks: ['ISO27001'],
        completionPercentage: 100,
      },
    ];

    // Apply search filter
    let filteredConversations = mockConversations;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredConversations = filteredConversations.filter(
        (conv) =>
          conv.title.toLowerCase().includes(searchLower) ||
          conv.lastMessage.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters?.status && filters.status.length > 0) {
      filteredConversations = filteredConversations.filter((conv) =>
        filters.status.includes(conv.status)
      );
    }

    // Apply pinned filter
    if (filters?.showPinned) {
      filteredConversations = filteredConversations.filter((conv) => conv.isPinned);
    }

    // Apply archived filter
    if (!filters?.showArchived) {
      filteredConversations = filteredConversations.filter((conv) => !conv.isArchived);
    }

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedConversations = filteredConversations.slice(start, end);
    const hasMore = end < filteredConversations.length;

    return NextResponse.json({
      conversations: paginatedConversations,
      hasMore,
      total: filteredConversations.length,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
