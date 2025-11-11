// ==================
// User Types
// ==================

export interface User {
  userId: string;
  email: string;
  name?: string; // Optional - not always returned by API
  createdAt: number;
  isAdmin?: boolean; // Platform admin status
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
  characterCount?: number;
  chunksCreated?: number; // Phase 5: Custom vector chunks created
  embeddingsGenerated?: number;
  vectorIndexingStatus?: 'pending' | 'processing' | 'indexing' | 'completed' | 'partial' | 'failed'; // Phase 2.4: Added 'indexing' status
  complianceFrameworkId?: number;
  fullyCompleted?: boolean; // CRITICAL FIX: Tracks when ALL processing (including AI enrichment) is complete
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

export type CheckStatus = 'pending' | 'running' | 'processing' | 'completed' | 'failed';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'; // Updated for Phase 2
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

// Phase 2: ComplianceIssue moved to types/compliance.ts
// This old definition is replaced by the more detailed one in compliance.ts
// export interface ComplianceIssue {
//   id: string;
//   checkId: string;
//   documentId: string;
//   severity: IssueSeverity;
//   category: string;
//   title: string;
//   description: string;
//   recommendation: string | null;
//   location: string | null;
//   status: IssueStatus;
//   createdAt: number;
// }

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
// PHASE 1: Enhanced Compliance Types
// ==================

// Phase 1.1.1: Batch Compliance Checking
export interface BatchComplianceCheck {
  batchId: string;
  workspaceId: string;
  framework: ComplianceFramework;
  total: number;
  completed: number;
  processing: number;
  failed: number;
  createdAt: number;
  checks: Array<{
    checkId: string;
    documentId: string;
    status: CheckStatus;
    overallScore: number | null;
  }>;
}

// Phase 1.2.1: CMMI Maturity Model
export type MaturityLevelName =
  | 'Initial'
  | 'Managed'
  | 'Defined'
  | 'Quantitatively Managed'
  | 'Optimizing';

export interface MaturityLevel {
  level: 1 | 2 | 3 | 4 | 5;
  name: MaturityLevelName;
  score: number; // 0-100
  description: string;
  characteristics: string[];
  nextSteps: string[];
}

// Phase 1.2.2: Framework Maturity Assessment
export interface FrameworkControl {
  id: string;
  category: string;
  description: string;
  covered: boolean;
  issuesFound: number;
  criticalIssues: number;
}

export interface GapAnalysisItem {
  controlId: string;
  category: string;
  description: string;
  severity: IssueSeverity;
  recommendation: string;
  effort: 'low' | 'medium' | 'high';
}

export interface FrameworkMaturity {
  framework: ComplianceFramework;
  overallCoverage: number; // 0-100
  totalControls: number;
  coveredControls: number;
  gaps: GapAnalysisItem[];
  strengths: string[];
  recommendations: string[];
  controlDetails: FrameworkControl[];
}

// Phase 1.3: Reporting & Executive Summary
export interface RiskItem {
  category: string;
  severity: IssueSeverity;
  count: number;
  description: string;
}

export interface FrameworkScoreItem {
  framework: ComplianceFramework;
  score: number;
  status: 'compliant' | 'needs_improvement' | 'non_compliant';
  coverage: number;
}

// Phase 2: Framework Score (for dashboard display)
export interface FrameworkScore {
  frameworkId: number;
  frameworkName: ComplianceFramework;
  displayName: string;
  score: number;
  checksCount: number;
  lastCheckDate: number | null;
}

export interface RecommendationItem {
  priority: IssueSeverity;
  title: string;
  description: string;
  estimatedEffort: string;
}

export interface ExecutiveSummary {
  workspaceId: string;
  generatedAt: number;
  reportPeriod: {
    startDate: number;
    endDate: number;
  };
  overview: {
    overallScore: number;
    maturityLevel: number;
    totalDocuments: number;
    documentsChecked: number;
    coveragePercentage: number;
    totalIssues: number;
    criticalIssues: number;
  };
  keyFindings: string[];
  topRisks: RiskItem[];
  frameworkSummary: FrameworkScoreItem[];
  recommendations: RecommendationItem[];
  trends: {
    scoreChange: number;
    issueChange: number;
    coverageChange: number;
  };
}

// Phase 1.3.4: Data Export Types
export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
  frameworks?: ComplianceFramework[];
  startDate?: number;
  endDate?: number;
  includeChecks?: boolean;
  includeIssues?: boolean;
}

export interface ExportData {
  exportId: string;
  workspaceId: string;
  format: ExportFormat;
  generatedAt: number;
  data: string; // JSON string or CSV string
  filename: string;
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

// ====================
// PHASE 2: Document-Level Compliance Types
// ====================

export * from './compliance';
