/**
 * Issue Comment Service
 * Handles comments and activity timeline for compliance issues
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';
import { Env } from './raindrop.gen';
import { nanoid } from 'nanoid';

interface AddCommentInput {
  issueId: string;
  workspaceId: string;
  userId: string;
  commentText: string;
  commentType?: 'comment' | 'status_change' | 'assignment' | 'resolution' | 'system';
  metadata?: Record<string, any>;
}

interface GetCommentsInput {
  issueId: string;
  workspaceId: string;
  userId: string;
  limit?: number;
  offset?: number;
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Issue Comment Service - Private', { status: 501 });
  }

  /**
   * Add a comment to an issue
   */
  async addComment(input: AddCommentInput): Promise<{
    success: boolean;
    commentId?: string;
    error?: string;
  }> {
    const db = this.getDb();
    const now = Date.now();

    try {
      // Verify user has workspace access
      const membership = await db
        .selectFrom('workspace_members')
        .select('role')
        .where('workspace_id', '=', input.workspaceId)
        .where('user_id', '=', input.userId)
        .executeTakeFirst();

      if (!membership) {
        return { success: false, error: 'Access denied: Not a workspace member' };
      }

      // Verify issue exists
      const issue = await db
        .selectFrom('compliance_issues')
        .select(['id', 'title', 'assigned_to'])
        .where('id', '=', input.issueId)
        .where('workspace_id', '=', input.workspaceId)
        .executeTakeFirst();

      if (!issue) {
        return { success: false, error: 'Issue not found' };
      }

      // Create comment
      const commentId = `cmt_${Date.now()}_${nanoid(10)}`;
      await db
        .insertInto('issue_comments')
        .values({
          id: commentId,
          issue_id: input.issueId,
          workspace_id: input.workspaceId,
          user_id: input.userId,
          comment_text: input.commentText,
          comment_type: input.commentType || 'comment',
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      // Notify via internal webhook (fire-and-forget)
      fetch('http://notification-service/internal/webhook/issue-commented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: input.issueId,
          workspaceId: input.workspaceId,
          commentId,
          userId: input.userId,
          commentText: input.commentText,
          issueTitle: issue.title,
          assignedTo: issue.assigned_to,
          timestamp: now,
        })
      }).catch(err => {
        this.env.logger.error('Failed to send comment notification', { error: err });
      });

      return { success: true, commentId };
    } catch (error: any) {
      this.env.logger.error('Failed to add comment', {
        error: error.message,
        issueId: input.issueId,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get comments for an issue (activity timeline)
   */
  async getComments(input: GetCommentsInput): Promise<{
    success: boolean;
    comments?: Array<{
      id: string;
      userId: string;
      userEmail: string;
      commentText: string;
      commentType: string;
      metadata: Record<string, any> | null;
      createdAt: number;
    }>;
    total?: number;
    error?: string;
  }> {
    const db = this.getDb();

    try {
      // Verify user has workspace access
      const membership = await db
        .selectFrom('workspace_members')
        .select('role')
        .where('workspace_id', '=', input.workspaceId)
        .where('user_id', '=', input.userId)
        .executeTakeFirst();

      if (!membership) {
        return { success: false, error: 'Access denied: Not a workspace member' };
      }

      const limit = input.limit || 50;
      const offset = input.offset || 0;

      // Get comments with user info
      const comments = await db
        .selectFrom('issue_comments')
        .innerJoin('users', 'issue_comments.user_id', 'users.id')
        .select([
          'issue_comments.id',
          'issue_comments.user_id as userId',
          'users.email as userEmail',
          'issue_comments.comment_text as commentText',
          'issue_comments.comment_type as commentType',
          'issue_comments.metadata',
          'issue_comments.created_at as createdAt',
        ])
        .where('issue_comments.issue_id', '=', input.issueId)
        .where('issue_comments.workspace_id', '=', input.workspaceId)
        .orderBy('issue_comments.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count
      const countResult = await db
        .selectFrom('issue_comments')
        .select(({ fn }) => fn.countAll().as('count'))
        .where('issue_id', '=', input.issueId)
        .where('workspace_id', '=', input.workspaceId)
        .executeTakeFirst();

      const total = Number(countResult?.count || 0);

      const formattedComments = comments.map((c) => ({
        id: c.id,
        userId: c.userId,
        userEmail: c.userEmail,
        commentText: c.commentText,
        commentType: c.commentType,
        metadata: c.metadata ? JSON.parse(c.metadata) : null,
        createdAt: c.createdAt,
      }));

      return {
        success: true,
        comments: formattedComments,
        total,
      };
    } catch (error: any) {
      this.env.logger.error('Failed to get comments', {
        error: error.message,
        issueId: input.issueId,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a comment (owner or admin only)
   */
  async deleteComment(input: {
    commentId: string;
    workspaceId: string;
    userId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const db = this.getDb();

    try {
      // Get comment to check ownership
      const comment = await db
        .selectFrom('issue_comments')
        .select(['user_id', 'workspace_id'])
        .where('id', '=', input.commentId)
        .executeTakeFirst();

      if (!comment) {
        return { success: false, error: 'Comment not found' };
      }

      // Verify workspace matches
      if (comment.workspace_id !== input.workspaceId) {
        return { success: false, error: 'Comment not in this workspace' };
      }

      // Check if user is comment owner or workspace admin
      const isOwner = comment.user_id === input.userId;
      const membership = await db
        .selectFrom('workspace_members')
        .select('role')
        .where('workspace_id', '=', input.workspaceId)
        .where('user_id', '=', input.userId)
        .executeTakeFirst();

      const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

      if (!isOwner && !isAdmin) {
        return { success: false, error: 'Access denied: Not authorized to delete this comment' };
      }

      // Delete comment
      await db
        .deleteFrom('issue_comments')
        .where('id', '=', input.commentId)
        .execute();

      return { success: true };
    } catch (error: any) {
      this.env.logger.error('Failed to delete comment', {
        error: error.message,
        commentId: input.commentId,
      });
      return { success: false, error: error.message };
    }
  }
}
