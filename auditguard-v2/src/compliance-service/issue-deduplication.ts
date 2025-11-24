// Issue Deduplication and Fingerprinting System
// Purpose: Prevent duplicate issues across multiple compliance checks on the same document

import { Kysely } from 'kysely';
import { DB } from '../db/auditguard-db/types';

interface ComplianceIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  location?: string;
  confidence?: number;
  // Complete LLM response for this specific issue
  llm_response?: any;
}

interface IssueProcessingResult {
  issueId: string;
  isNew: boolean;
  status: 'created' | 'updated' | 'reopened' | 'dismissed_confirmed';
  previousStatus?: string;
}

/**
 * Generate a unique fingerprint for an issue to enable deduplication
 * Uses normalized content hash to identify identical issues across checks
 */
export function generateIssueFingerprint(
  issue: ComplianceIssue,
  documentId: string,
  framework: string
): string {
  // Normalize text: lowercase, trim, collapse whitespace
  const normalize = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');

  const normalizedTitle = normalize(issue.title);
  const normalizedDesc = normalize(issue.description);
  const normalizedCategory = normalize(issue.category);

  // Create content string for hashing
  const content = `${normalizedTitle}|${normalizedCategory}|${issue.severity}|${normalizedDesc}`;

  // Simple hash function (FNV-1a variant)
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Convert to hex string (16 chars)
  return Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16);
}

/**
 * Process an issue with deduplication logic
 * Checks if issue exists and updates/creates accordingly
 */
export async function processIssueWithDeduplication(
  db: Kysely<DB>,
  issue: ComplianceIssue,
  checkId: string,
  documentId: string,
  workspaceId: string,
  framework: string,
  priority: number
): Promise<IssueProcessingResult> {
  // Generate fingerprint for this issue
  const fingerprint = generateIssueFingerprint(issue, documentId, framework);

  // Check if this issue already exists (active issues only)
  const existingIssue = await db
    .selectFrom('compliance_issues')
    .selectAll()
    .where('document_id', '=', documentId)
    .where('framework', '=', framework)
    .where('issue_fingerprint', '=', fingerprint)
    .where('is_active', '=', 1) // Active issues only
    .executeTakeFirst();

  if (existingIssue) {
    // Issue exists - update it
    return await updateExistingIssue(db, existingIssue, issue, checkId, priority);
  } else {
    // New issue - create it
    return await createNewIssue(db, issue, checkId, documentId, workspaceId, framework, fingerprint, priority);
  }
}

/**
 * Update an existing issue that was found again
 * Handles status transitions (resolved -> reopened, etc.)
 */
async function updateExistingIssue(
  db: Kysely<DB>,
  existingIssue: any,
  newIssueData: ComplianceIssue,
  checkId: string,
  priority: number
): Promise<IssueProcessingResult> {
  const now = Date.now();
  const updates: any = {
    last_confirmed_check_id: checkId,
    confidence: newIssueData.confidence || 70,
    updated_at: now,
    priority,
    llm_response: newIssueData.llm_response ? JSON.stringify(newIssueData.llm_response) : null,
  };

  let newStatus = existingIssue.status;
  let resultStatus: 'updated' | 'reopened' | 'dismissed_confirmed' = 'updated';

  // Handle status transitions
  if (existingIssue.status === 'resolved') {
    // Issue was resolved but found again - reopen it
    updates.status = 'reopened';
    newStatus = 'reopened';
    resultStatus = 'reopened';

    // Log status change
    await logStatusChange(db, existingIssue.id, 'resolved', 'reopened', 'system', 
      'Issue detected again in new compliance check');

    // TODO: Send notification to assignee if exists
    // This will be handled by the notification service observer
  } else if (existingIssue.status === 'dismissed') {
    // Keep dismissed but log detection
    await logStatusChange(db, existingIssue.id, 'dismissed', 'dismissed', 'system',
      'Issue still detected but remains dismissed');
    resultStatus = 'dismissed_confirmed';
  }
  // For open/in_progress/review - just update confidence and timestamp

  // Update the issue
  await db
    .updateTable('compliance_issues')
    .set(updates)
    .where('id', '=', existingIssue.id)
    .execute();

  // Publish event for status changes
  if (resultStatus === 'reopened') {
    // Event will be picked up by notification service
    // context.publishEvent('issue.reopened', { issueId: existingIssue.id, ... })
  }

  return {
    issueId: existingIssue.id,
    isNew: false,
    status: resultStatus,
    previousStatus: existingIssue.status,
  };
}

/**
 * Create a new issue with fingerprint
 */
async function createNewIssue(
  db: Kysely<DB>,
  issue: ComplianceIssue,
  checkId: string,
  documentId: string,
  workspaceId: string,
  framework: string,
  fingerprint: string,
  priority: number
): Promise<IssueProcessingResult> {
  const issueId = `iss_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = Date.now();

  await db
    .insertInto('compliance_issues')
    .values({
      id: issueId,
      check_id: checkId,
      document_id: documentId,
      workspace_id: workspaceId,
      framework: framework,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      location: issue.location || null,
      status: 'open',
      confidence: issue.confidence || 70,
      priority,
      created_at: now,
      llm_response: issue.llm_response ? JSON.stringify(issue.llm_response) : null,
      // Fingerprinting fields
      issue_fingerprint: fingerprint,
      is_active: 1,
      first_detected_check_id: checkId,
      last_confirmed_check_id: checkId,
      superseded_by: null,
    } as any)
    .execute();

  return {
    issueId,
    isNew: true,
    status: 'created',
  };
}

/**
 * Log status changes for audit trail
 */
async function logStatusChange(
  db: Kysely<DB>,
  issueId: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  reason: string
): Promise<void> {
  const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  await db
    .insertInto('issue_status_history')
    .values({
      id: historyId,
      issue_id: issueId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
      reason: reason,
      changed_at: Date.now(),
    } as any)
    .execute();
}

/**
 * Backfill fingerprints for existing issues (migration utility)
 */
export async function backfillIssueFingerprints(db: Kysely<DB>): Promise<number> {
  // Get all issues without fingerprints
  const issuesWithoutFingerprints = await db
    .selectFrom('compliance_issues')
    .selectAll()
    .where('issue_fingerprint', 'is', null)
    .execute();

  let updated = 0;

  for (const issue of issuesWithoutFingerprints) {
    const fingerprint = generateIssueFingerprint(
      {
        severity: issue.severity as any,
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation || '',
        location: issue.location || undefined,
        confidence: issue.confidence || undefined,
      },
      issue.document_id,
      issue.framework || ''
    );

    await db
      .updateTable('compliance_issues')
      .set({
        issue_fingerprint: fingerprint,
        is_active: 1,
        first_detected_check_id: issue.check_id,
        last_confirmed_check_id: issue.check_id,
      } as any)
      .where('id', '=', issue.id)
      .execute();

    updated++;
  }

  return updated;
}
