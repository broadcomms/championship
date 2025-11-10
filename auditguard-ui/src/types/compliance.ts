/**
 * Compliance Analysis Types
 * TypeScript definitions for compliance features
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type ComplianceCheckStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ComplianceIssue {
  id: string;
  checkId: string;
  severity: IssueSeverity;
  category: string;
  title: string;
  description: string;
  recommendation: string | null;
  excerpt: string | null;
  regulationCitation: string | null;
  riskScore: number | null;
  sectionRef: string | null;
  status: IssueStatus;
  assignedTo: string | null;
  resolvedAt: number | null;
  resolvedBy: string | null;
  createdAt: number;
  updatedAt: number | null;
}

export interface ComplianceIssueDetails extends ComplianceIssue {
  documentId: string;
  documentName: string;
  framework: string;
  fullExcerpt: string | null;
  remediationSteps: string[] | null;
  chunkIds: string[] | null;
  resolutionNotes: string | null;
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
  resolved: 'bg-green-100 text-green-800 border-green-300',
  dismissed: 'bg-gray-100 text-gray-800 border-gray-300',
};

// Status labels
export const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

// Severity labels
export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};
