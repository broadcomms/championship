/**
 * Conversation Management Types
 * Phase 4 - Conversation Management
 */

export type ConversationStatus = 'active' | 'completed' | 'archived' | 'in_progress';
export type ConversationCategory = 'compliance' | 'support' | 'training' | 'general' | 'audit';
export type Framework = 'GDPR' | 'SOC2' | 'ISO27001' | 'HIPAA' | 'PCI' | 'NIST' | 'CCPA';

export interface ConversationMetadata {
  messageCount: number;
  duration: number; // in seconds
  tokens: number;
  cost: number;
  voiceMessageCount?: number;
  attachmentCount?: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationTag {
  id: string;
  name: string;
  color?: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title: string;
  preview: string; // Last message preview
  status: ConversationStatus;
  category: ConversationCategory;
  frameworks: Framework[];
  tags: ConversationTag[];
  metadata: ConversationMetadata;
  isPinned: boolean;
  isArchived: boolean;
  isUnread: boolean;
  complianceScore?: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationGroup {
  label: string;
  conversations: Conversation[];
  isExpanded: boolean;
}

export interface FilterOptions {
  search: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  categories: ConversationCategory[];
  frameworks: Framework[];
  status: ConversationStatus[];
  tags: string[];
  showArchived: boolean;
  showPinned: boolean;
}

export interface SortOptions {
  field: 'updatedAt' | 'createdAt' | 'messageCount' | 'title';
  direction: 'asc' | 'desc';
}

export interface BatchOperation {
  conversationIds: string[];
  operation: 'pin' | 'unpin' | 'archive' | 'unarchive' | 'delete' | 'tag' | 'untag';
  data?: any;
}

export interface ConversationListState {
  conversations: Conversation[];
  groups: ConversationGroup[];
  filters: FilterOptions;
  sort: SortOptions;
  selectedIds: string[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
}

export interface ConversationAction {
  type: 'pin' | 'archive' | 'delete' | 'export' | 'share' | 'tag';
  label: string;
  icon: string;
  handler: (conversationId: string) => void;
  requiresConfirmation?: boolean;
}

export const DEFAULT_FILTERS: FilterOptions = {
  search: '',
  dateRange: {
    start: null,
    end: null,
  },
  categories: [],
  frameworks: [],
  status: [],
  tags: [],
  showArchived: false,
  showPinned: false,
};

export const DEFAULT_SORT: SortOptions = {
  field: 'updatedAt',
  direction: 'desc',
};

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  GDPR: 'GDPR',
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001',
  HIPAA: 'HIPAA',
  PCI: 'PCI DSS',
  NIST: 'NIST',
  CCPA: 'CCPA',
};

export const CATEGORY_LABELS: Record<ConversationCategory, string> = {
  compliance: 'Compliance',
  support: 'Support',
  training: 'Training',
  general: 'General',
  audit: 'Audit',
};

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
  in_progress: 'In Progress',
};
