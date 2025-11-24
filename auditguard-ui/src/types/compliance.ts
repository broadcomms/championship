/**
 * Compliance Analysis Types
 * TypeScript definitions for compliance features
 */

import { ComplianceFramework } from './index';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueStatus = 'open' | 'in_progress' | 'review' | 'resolved' | 'dismissed';
export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4';
export type ComplianceCheckStatus = 'pending' | 'running' | 'processing' | 'completed' | 'failed';

export interface ComplianceIssue {
  id: string;
  checkId: string;
  documentId: string;
  workspaceId: string;
  framework: string | null;
  severity: IssueSeverity;
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  excerpt: string | null;
  fullExcerpt: string | null;
  regulationCitation: string | null;
  riskScore: number | null;
  sectionRef: string | null;
  chunkIds: string | null; // JSON string array
  remediationSteps: string | null; // Can be JSON string or plain text
  confidence: number | null; // 0-100 confidence score
  status: IssueStatus;
  assignedTo: string | null;
  assignedAt: string | null; // ISO 8601 timestamp
  dueDate: string | null; // ISO 8601 date
  priorityLevel: PriorityLevel | null;
  resolvedAt: number | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: number;
  updatedAt: number | null;
  // Complete LLM response for this issue with enhanced details
  llmResponse?: LLMIssueResponse | null;
  // Populated fields (from joins)
  documentName?: string;
}

export interface LLMIssueResponse {
  severity: IssueSeverity;
  category: string;
  title: string;
  description: string;
  impact?: string;
  impact_assessment?: string;
  original_text?: string;
  framework?: string;
  framework_section?: string;
  framework_subsection?: string;
  framework_article?: string;
  framework_requirement?: string;
  recommendation: string;
  current_state?: string;
  required_state?: string;
  fix?: string;
  suggested_text?: string;
  confidence: number;
}

export interface ComplianceIssueDetails extends ComplianceIssue {
  // Already included in ComplianceIssue now, so this interface is for backward compatibility
  // or for future additional enriched fields
}

export interface ComplianceCheck {
  id: string;
  framework: string;
  status: ComplianceCheckStatus;
  overallScore: number | null;
  issuesFound: number;
  createdAt: number;
  completedAt: number | null;
}

export interface DocumentComplianceSummary {
  overallScore: number | null;
  riskLevel: string | null;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  openIssues: number;
  resolvedIssues: number;
  lastAnalyzedAt: number;
  lastCheckId: string | null;
}

export interface IssuesListFilters {
  severity?: IssueSeverity[];
  status?: IssueStatus[];
  search?: string;
  checkId?: string;
}

export interface IssuesResponse {
  issues: ComplianceIssue[];
  total: number;
  hasMore: boolean;
}

export interface BulkIssueAction {
  issueIds: string[];
  action: 'resolve' | 'dismiss' | 'reopen';
  notes?: string;
}

export interface IssueAssignment {
  issueId: string;
  assignedTo: string;
  notes?: string;
}

export interface IssueAssignmentHistory {
  id: string;
  assignedBy: string;
  assignedTo: string;
  assignedAt: number;
  unassignedAt: number | null;
  notes: string | null;
}

// ==================
// Issue Comments & Activity (Phase 4)
// ==================

export type CommentType = 'comment' | 'status_change' | 'assignment' | 'resolution' | 'system';

export interface IssueComment {
  id: string;
  issueId: string;
  workspaceId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  commentText: string;
  commentType: CommentType;
  metadata: string | null; // JSON string with additional data
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface IssueCommentsResponse {
  comments: IssueComment[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkspaceMember {
  userId: string;
  name: string | null;
  email: string;
  role: string;
}

export interface MemberSearchResponse {
  members: WorkspaceMember[];
  total: number;
}

// Badge colors for severity levels
export const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 text-gray-800 border-gray-300',
};

// Badge colors for status
export const STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'bg-red-100 text-red-800 border-red-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
  dismissed: 'bg-gray-100 text-gray-800 border-gray-300',
};

// Status labels
export const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  review: 'Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

// Priority colors
export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  P1: 'bg-red-500 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-yellow-500 text-white',
  P4: 'bg-gray-400 text-white',
};

// Priority labels
export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  P1: 'P1 - Critical',
  P2: 'P2 - High',
  P3: 'P3 - Medium',
  P4: 'P4 - Low',
};

// Severity labels
export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

// ==================
// Reporting Types (Phase 3)
// ==================

export type ReportFormat = 'json' | 'csv';
export type ReportType = 'compliance_data' | 'executive_summary';

export interface ReportGenerationRequest {
  workspaceId: string;
  frameworks?: string[];
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  includeChecks?: boolean;
  includeIssues?: boolean;
  format: ReportFormat;
}

export interface ExecutiveSummaryRequest {
  workspaceId: string;
  frameworks?: string[];
  startDate?: string;
  endDate?: string;
}

export interface ExecutiveSummary {
  workspaceId: string;
  generatedAt: number;
  reportPeriod: {
    startDate: string;
    endDate: string;
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
  topRisks: Array<{
    framework: ComplianceFramework;
    issueCount: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  frameworkSummary: Array<{
    framework: ComplianceFramework;
    score: number;
    checksCompleted: number;
    issuesFound: number;
    status: 'compliant' | 'partial' | 'non-compliant';
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedEffort: string;
  }>;
  trends: {
    scoreChange: number;
    issueChange: number;
    coverageChange: number;
  };
}

// Stored compliance report with metadata
export interface ComplianceReport {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
  frameworks: ComplianceFramework[];
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: ExecutiveSummary;
  status: 'completed' | 'failed' | 'processing';
}

// Report list item (lightweight for listing)
export interface ComplianceReportListItem {
  id: string;
  name: string;
  createdAt: number;
  frameworks: ComplianceFramework[];
  overallScore: number;
  totalIssues: number;
  criticalIssues: number;
  status: 'completed' | 'failed' | 'processing';
}

export interface ReportExportResponse {
  format: ReportFormat;
  generatedAt: number;
  data: string; // JSON string or CSV content
  filename: string;
}
