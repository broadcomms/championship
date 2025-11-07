// ==================
// User Types
// ==================

export interface User {
  userId: string;
  email: string;
  name?: string; // Optional - not always returned by API
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

// ==================
// Workspace Types
// ==================

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joinedAt: number;
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
  memberCount: number;
  documentCount: number;
}

// ==================
// Document Types
// ==================

export type DocumentCategory = 'policy' | 'procedure' | 'evidence' | 'other';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  workspaceId: string;
  filename: string;
  title?: string; // AI-extracted title
  description?: string; // AI-extracted description
  fileSize: number;
  contentType: string;
  category: DocumentCategory | null;
  storageKey: string;
  vultrKey?: string; // Vultr S3 key for original file
  uploadedBy: string;
  uploadedAt: number;
  updatedAt: number;
  processingStatus: ProcessingStatus;
  textExtracted: boolean;
  chunkCount: number;
  pageCount?: number;
  wordCount?: number;
  chunksCreated?: number; // Phase 5: Custom vector chunks created
  embeddingsGenerated?: number;
  vectorIndexingStatus?: 'pending' | 'processing' | 'indexing' | 'completed' | 'partial' | 'failed'; // Phase 2.4: Added 'indexing' status
  complianceFrameworkId?: number;
}

// Phase 4 & 5: Compliance Framework Types
export interface ComplianceFrameworkInfo {
  id: number;
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
}

// Phase 4 & 5: Document Chunk Types
export interface DocumentChunk {
  id: number;
  documentId: string;
  chunkIndex: number;
  content: string;
  chunkSize: number;
  startChar: number;
  endChar: number;
  tokenCount: number;
  hasHeader: boolean;
  sectionTitle?: string;
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  tags?: ChunkFrameworkTag[];
}

export interface ChunkFrameworkTag {
  frameworkId: number;
  frameworkName: string;
  frameworkDisplayName: string;
  relevanceScore: number;
  autoTagged: boolean;
}

export interface DocumentListItem {
  id: string;
  filename: string;
  title?: string; // AI-extracted title
  description?: string; // AI-extracted description
  fileSize: number;
  contentType: string;
  category: DocumentCategory | null;
  uploadedBy: string;
  uploaderEmail: string;
  uploadedAt: number;
  updatedAt: number;
  processingStatus: ProcessingStatus;
}

// ==================
// Compliance Types
// ==================

export type ComplianceFramework =
  | 'GDPR'
  | 'SOC2'
  | 'HIPAA'
  | 'PCI_DSS'
  | 'ISO_27001'
  | 'NIST_CSF'
  | 'CCPA'
  | 'FERPA'
  | 'GLBA'
  | 'FISMA'
  | 'PIPEDA'
  | 'COPPA'
  | 'SOX';

export type CheckStatus = 'processing' | 'completed' | 'failed';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceCheck {
  id: string;
  documentId: string;
  workspaceId: string;
  framework: ComplianceFramework;
  status: CheckStatus;
  overallScore: number | null;
  issuesFound: number;
  createdAt: number;
  completedAt: number | null;
  createdBy: string;
}

export interface ComplianceCheckListItem extends ComplianceCheck {
  documentName: string;
}

export interface ComplianceIssue {
  id: string;
  checkId: string;
  documentId: string;
  severity: IssueSeverity;
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  location: string | null;
  status: IssueStatus;
  createdAt: number;
}

// ==================
// Analytics Types
// ==================

export interface WorkspaceScore {
  workspaceId: string;
  overallScore: number;
  riskLevel: RiskLevel;
  totalDocuments: number;
  totalChecks: number;
  calculatedAt: number;
  breakdown: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    infoIssues: number;
  };
}

export interface Dashboard {
  workspaceId: string;
  overallScore: number;
  riskLevel: RiskLevel;
  recentActivity: {
    documentsUploaded: number;
    checksCompleted: number;
    issuesResolved: number;
    period: string;
  };
  complianceByFramework: Array<{
    framework: ComplianceFramework;
    averageScore: number;
    checksCount: number;
    lastCheckDate: number;
  }>;
  topIssues: Array<{
    category: string;
    count: number;
    severity: IssueSeverity;
  }>;
  documentCoverage: {
    total: number;
    checked: number;
    percentage: number;
  };
}

export interface TrendAnalysis {
  workspaceId: string;
  period: {
    days: number;
    startDate: number;
    endDate: number;
  };
  scoreHistory: Array<{
    date: string;
    score: number;
    checksCompleted: number;
  }>;
  issuesTrend: Array<{
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  }>;
  frameworkActivity: Array<{
    framework: ComplianceFramework;
    checksPerformed: number;
    averageScore: number;
  }>;
}

// ==================
// Assistant Types
// ==================

// Phase 2.4: Vector Search Request Type
export interface VectorSearchRequest {
  query: string;
  frameworkId?: number;
  retryForIndexing?: boolean; // Retry search if no results found (for recently uploaded documents)
}

export interface AssistantSession {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  timestamp: number;
  workspaceId: string;
}

// ==================
// Billing Types
// ==================

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: {
    users: number;
    workspaces: number;
    documents: number;
    storage_gb: number;
    compliance_checks: number;
    ai_messages: number;
  };
  active: boolean;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  stripeSubscriptionId: string | null;
}

export interface UsageLimit {
  limit: number;
  current: number;
  percentage: number;
  allowed: boolean;
}

export interface WorkspaceLimits {
  workspaceId: string;
  planId: string;
  limits: {
    users: UsageLimit;
    documents: UsageLimit;
    storage_gb: UsageLimit;
    compliance_checks: UsageLimit;
    ai_messages: UsageLimit;
  };
  checkedAt: number;
}

// ==================
// Annotation Types
// ==================

export type AnnotationType = 'comment' | 'highlight' | 'suggestion' | 'issue';

export interface Annotation {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  userName?: string;
  content: string;
  location: string;
  type: AnnotationType;
  createdAt: number;
}

// ==================
// API Response Types
// ==================

export interface ErrorResponse {
  error: string;
  status: number;
  details?: any;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
