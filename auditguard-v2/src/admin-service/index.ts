import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

interface CreateAdminInput {
  userId: string;
  role: 'super_admin' | 'support' | 'billing_admin';
  permissions: string[];
  createdBy: string;
}

interface SystemStatsResponse {
  totalUsers: number;
  totalWorkspaces: number;
  totalDocuments: number;
  totalChecks: number;
  activeSubscriptions: number;
  revenue: {
    monthly: number;
    yearly: number;
  };
}

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response('Admin Service - Private', { status: 501 });
  }

  async isAdmin(userId: string): Promise<boolean> {
    const db = this.getDb();

    const admin = await db.selectFrom('admin_users').select('user_id').where('user_id', '=', userId).executeTakeFirst();

    return !!admin;
  }

  async createAdmin(adminUserId: string, input: CreateAdminInput): Promise<{ success: boolean }> {
    const db = this.getDb();

    // Verify caller is super_admin
    const caller = await db
      .selectFrom('admin_users')
      .select('role')
      .where('user_id', '=', adminUserId)
      .executeTakeFirst();

    if (!caller || caller.role !== 'super_admin') {
      throw new Error('Access denied: Only super admins can create admin users');
    }

    // Check if user exists
    const user = await db.selectFrom('users').select('id').where('id', '=', input.userId).executeTakeFirst();

    if (!user) {
      throw new Error('User not found');
    }

    // Create admin
    const now = Date.now();

    await db
      .insertInto('admin_users')
      .values({
        user_id: input.userId,
        role: input.role,
        permissions: JSON.stringify(input.permissions),
        created_at: now,
        created_by: input.createdBy,
      })
      .execute();

    // Log action
    await this.logAdminAction(adminUserId, 'create_admin', 'admin_user', input.userId, {
      role: input.role,
      permissions: input.permissions,
    });

    return { success: true };
  }

  async getSystemStats(adminUserId: string): Promise<SystemStatsResponse> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    // Get stats
    const [userCount, workspaceCount, documentCount, checkCount, subscriptionCount] = await Promise.all([
      db
        .selectFrom('users')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('workspaces')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('documents')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('compliance_checks')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .executeTakeFirst(),

      db
        .selectFrom('subscriptions')
        .select(({ fn }) => fn.count<number>('id').as('count'))
        .where('status', '=', 'active')
        .executeTakeFirst(),
    ]);

    // Calculate revenue (from active subscriptions)
    const subscriptions = await db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscriptions.plan_id', 'subscription_plans.id')
      .select(['subscription_plans.price_monthly', 'subscription_plans.price_yearly'])
      .where('subscriptions.status', '=', 'active')
      .execute();

    let monthlyRevenue = 0;
    let yearlyRevenue = 0;

    for (const sub of subscriptions) {
      monthlyRevenue += sub.price_monthly;
      yearlyRevenue += sub.price_yearly;
    }

    return {
      totalUsers: userCount?.count || 0,
      totalWorkspaces: workspaceCount?.count || 0,
      totalDocuments: documentCount?.count || 0,
      totalChecks: checkCount?.count || 0,
      activeSubscriptions: subscriptionCount?.count || 0,
      revenue: {
        monthly: monthlyRevenue,
        yearly: yearlyRevenue,
      },
    };
  }

  async getAllUsers(adminUserId: string, limit: number = 50, offset: number = 0): Promise<{
    users: Array<{
      id: string;
      email: string;
      createdAt: number;
      workspaceCount: number;
    }>;
    total: number;
  }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const users = await db
      .selectFrom('users')
      .leftJoin('workspaces', 'users.id', 'workspaces.owner_id')
      .select(['users.id', 'users.email', 'users.created_at', ({ fn }) => fn.count<number>('workspaces.id').as('workspace_count')])
      .groupBy('users.id')
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const totalResult = await db
      .selectFrom('users')
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .executeTakeFirst();

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        workspaceCount: u.workspace_count || 0,
      })),
      total: totalResult?.count || 0,
    };
  }

  async getSystemSettings(adminUserId: string): Promise<{
    settings: Record<string, { value: string; type: string; description: string | null }>;
  }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const settings = await db.selectFrom('system_settings').selectAll().execute();

    const result: Record<string, { value: string; type: string; description: string | null }> = {};

    for (const setting of settings) {
      result[setting.key] = {
        value: setting.value,
        type: setting.value_type,
        description: setting.description,
      };
    }

    return { settings: result };
  }

  async updateSystemSetting(
    adminUserId: string,
    key: string,
    value: string
  ): Promise<{ success: boolean; key: string; value: string }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const now = Date.now();

    await db
      .updateTable('system_settings')
      .set({
        value,
        updated_at: now,
        updated_by: adminUserId,
      })
      .where('key', '=', key)
      .execute();

    // Log action
    await this.logAdminAction(adminUserId, 'update_setting', 'system_setting', key, { value });

    return { success: true, key, value };
  }

  async getAuditLog(adminUserId: string, limit: number = 50): Promise<{
    logs: Array<{
      id: string;
      adminUserId: string;
      adminEmail: string;
      action: string;
      resourceType: string;
      resourceId: string | null;
      changes: Record<string, unknown> | null;
      createdAt: number;
    }>;
  }> {
    const db = this.getDb();

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const logs = await db
      .selectFrom('admin_audit_log')
      .innerJoin('users', 'admin_audit_log.admin_user_id', 'users.id')
      .select([
        'admin_audit_log.id',
        'admin_audit_log.admin_user_id',
        'users.email as admin_email',
        'admin_audit_log.action',
        'admin_audit_log.resource_type',
        'admin_audit_log.resource_id',
        'admin_audit_log.changes',
        'admin_audit_log.created_at',
      ])
      .orderBy('admin_audit_log.created_at', 'desc')
      .limit(limit)
      .execute();

    return {
      logs: logs.map((log) => ({
        id: log.id,
        adminUserId: log.admin_user_id,
        adminEmail: log.admin_email,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        changes: log.changes ? JSON.parse(log.changes) : null,
        createdAt: log.created_at,
      })),
    };
  }

  private async logAdminAction(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    changes?: Record<string, unknown>
  ): Promise<void> {
    const db = this.getDb();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      await db
        .insertInto('admin_audit_log')
        .values({
          id: logId,
          admin_user_id: adminUserId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          changes: changes ? JSON.stringify(changes) : null,
          ip_address: null,
          created_at: Date.now(),
        })
        .execute();
    } catch (error) {
      this.env.logger.error(`Failed to log admin action: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async queryAnalytics(adminUserId: string, query: string): Promise<{
    result: Record<string, unknown>;
    query: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    // Use SmartSQL for natural language queries
    try {
      const result = await this.env.ANALYTICS_SMARTSQL.executeQuery({
        textQuery: query,
      });

      // Log the query
      await this.logAdminAction(adminUserId, 'analytics_query', 'smartsql', null, { query });

      return {
        result: result as unknown as Record<string, unknown>,
        query,
      };
    } catch (error) {
      this.env.logger.error(`SmartSQL query failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw new Error('Analytics query failed');
    }
  }

  /**
   * Phase 1: Get database schema information
   */
  async getDatabaseSchema(adminUserId: string): Promise<{
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
      }>;
      rowCount: number;
    }>;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Getting database schema', { adminUserId });

    // D1 doesn't allow sqlite_master queries, so we maintain a known list of tables
    const knownTables = [
      'users', 'sessions', 'workspaces', 'workspace_members', 'documents',
      'document_chunks', 'compliance_checks', 'compliance_frameworks',
      'compliance_tags', 'subscriptions', 'invoices', 'payment_methods',
      'api_keys', 'audit_logs', 'system_settings', 'admin_users',
      'admin_audit_log', 'error_logs', 'embeddings_queue', 'vector_metadata',
      'search_queries', 'usage_metrics'
    ];

    // For each table, get column info and row count
    const schemaInfo = [];

    for (const tableName of knownTables) {
      try {
        // Get column information using PRAGMA
        const columnsResult = await (this.env.AUDITGUARD_DB as any)
          .prepare(`PRAGMA table_info(${tableName})`)
          .all();

        // Skip if table doesn't exist
        if (!columnsResult.results || columnsResult.results.length === 0) {
          continue;
        }

        const columns = columnsResult.results.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          primaryKey: col.pk === 1,
        }));

        // Get row count
        const countResult = await (this.env.AUDITGUARD_DB as any)
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .first();

        schemaInfo.push({
          name: tableName,
          columns,
          rowCount: countResult?.count || 0,
        });
      } catch (error) {
        // Skip tables that don't exist or can't be queried
        this.env.logger.warn(`Could not get schema for table ${tableName}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    await this.logAdminAction(adminUserId, 'view_database_schema', 'database', null, {
      tableCount: schemaInfo.length,
    });

    this.env.logger.info('Database schema retrieved', {
      adminUserId,
      tableCount: schemaInfo.length,
    });

    return { tables: schemaInfo };
  }

  /**
   * Phase 1: Execute SQL query (READ-ONLY for safety)
   */
  async executeQuery(
    adminUserId: string,
    sql: string,
    params: any[] = []
  ): Promise<{
    columns: string[];
    rows: any[];
    rowCount: number;
    executionTime: number;
    warning?: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    // Security: Only allow SELECT queries
    const normalizedSql = sql.trim().toLowerCase();
    if (!normalizedSql.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed. Use SmartSQL for writes.');
    }

    // Block dangerous operations even in subqueries
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'pragma'];
    for (const keyword of dangerousKeywords) {
      if (normalizedSql.includes(keyword)) {
        throw new Error(`Keyword "${keyword}" is not allowed in read-only mode`);
      }
    }

    // Enforce row limit
    let finalSql = sql;
    if (!normalizedSql.includes('limit')) {
      finalSql += ' LIMIT 1000';
    }

    this.env.logger.info('Executing SQL query', {
      adminUserId,
      sql: finalSql.substring(0, 200),
    });

    const startTime = Date.now();

    try {
      // Execute query with timeout (10 seconds)
      const result = await Promise.race([
        (this.env.AUDITGUARD_DB as any).prepare(finalSql).all(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout (10s)')), 10000)
        ),
      ]) as any;

      const executionTime = Date.now() - startTime;

      const rows = result.results || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      await this.logAdminAction(adminUserId, 'execute_sql_query', 'database', null, {
        sql: finalSql.substring(0, 200),
        rowCount: rows.length,
        executionTime,
      });

      this.env.logger.info('SQL query executed successfully', {
        adminUserId,
        rowCount: rows.length,
        executionTime,
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTime,
        warning: rows.length >= 1000 ? 'Result set truncated to 1000 rows' : undefined,
      };

    } catch (error) {
      await this.logAdminAction(adminUserId, 'execute_sql_query_failed', 'database', null, {
        sql: finalSql.substring(0, 200),
        error: error instanceof Error ? error.message : String(error),
      });

      this.env.logger.error('SQL query failed', {
        adminUserId,
        sql: finalSql.substring(0, 200),
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Phase 1: Get paginated table data with optional filtering
   */
  async getTableData(
    adminUserId: string,
    tableName: string,
    options: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{
    columns: string[];
    rows: any[];
    totalRows: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    // Validate table exists
    const tableExists = await (this.env.AUDITGUARD_DB as any)
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .bind(tableName)
      .first();

    if (!tableExists) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 50, 500); // Max 500 rows
    const offset = (page - 1) * pageSize;

    this.env.logger.info('Getting table data', {
      adminUserId,
      tableName,
      page,
      pageSize,
    });

    // Get total count
    const countResult = await (this.env.AUDITGUARD_DB as any)
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .first();

    const totalRows = countResult?.count || 0;

    // Build query with optional ordering
    let query = `SELECT * FROM ${tableName}`;

    if (options.orderBy) {
      const orderDir = options.orderDir || 'ASC';
      query += ` ORDER BY ${options.orderBy} ${orderDir}`;
    }

    query += ` LIMIT ${pageSize} OFFSET ${offset}`;

    // Get paginated data
    const result = await (this.env.AUDITGUARD_DB as any).prepare(query).all();
    const rows = result.results || [];

    // Get column names
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    await this.logAdminAction(adminUserId, 'view_table_data', 'database', tableName, {
      page,
      pageSize,
      totalRows,
    });

    this.env.logger.info('Table data retrieved', {
      adminUserId,
      tableName,
      rowCount: rows.length,
      totalRows,
    });

    return {
      columns,
      rows,
      totalRows,
      page,
      pageSize,
      totalPages: Math.ceil(totalRows / pageSize),
    };
  }

  // ====== PHASE 2: VECTOR & EMBEDDING VERIFICATION ======

  /**
   * Phase 2.1: Get vector index statistics and health
   */
  async getVectorIndexStats(adminUserId: string): Promise<{
    indexName: string;
    dimensions: number;
    metric: string;
    totalVectors: number;
    databaseVectors: number;
    mismatch: number;
    sampleVectors: Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      hasEmbedding: boolean;
      embeddingStatus: string;
    }>;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Getting vector index statistics', { adminUserId });

    // Get vector index metadata using describe()
    let indexInfo: any = { dimensions: 384, metric: 'cosine', vectorCount: 0 };
    try {
      indexInfo = await this.env.DOCUMENT_EMBEDDINGS.describe();
    } catch (error) {
      this.env.logger.warn('Could not describe vector index', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Count vectors in database
    const countQuery = await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN vector_embedding IS NOT NULL THEN 1 ELSE 0 END) as hasBlob,
          SUM(CASE WHEN embedding_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM document_chunks
      `)
      .first();

    // Get sample of recent vectors
    const sampleResult = await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        SELECT vector_id, document_id, chunk_index, embedding_status, created_at
        FROM document_chunks
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .all();

    const sampleVectors = (sampleResult.results || []).map((v: any) => ({
      id: v.vector_id || 'none',
      documentId: v.document_id,
      chunkIndex: v.chunk_index,
      hasEmbedding: v.embedding_status === 'completed',
      embeddingStatus: v.embedding_status || 'unknown',
    }));

    await this.logAdminAction(adminUserId, 'view_vector_stats', 'vector_index', null, {
      totalVectors: indexInfo.vectorCount || 0,
      databaseVectors: countQuery?.completed || 0,
    });

    this.env.logger.info('Vector index statistics retrieved', {
      adminUserId,
      totalVectors: indexInfo.vectorCount || 0,
      databaseCompleted: countQuery?.completed || 0,
      pending: countQuery?.pending || 0,
      failed: countQuery?.failed || 0,
    });

    return {
      indexName: 'document-embeddings',
      dimensions: indexInfo.dimensions || 384,
      metric: indexInfo.metric || 'cosine',
      totalVectors: indexInfo.vectorCount || 0,
      databaseVectors: countQuery?.completed || 0,
      mismatch: Math.abs((indexInfo.vectorCount || 0) - (countQuery?.completed || 0)),
      sampleVectors,
    };
  }

  /**
   * Phase 2.2: Get comprehensive embedding generation status
   */
  async getEmbeddingStatus(adminUserId: string): Promise<{
    summary: {
      totalDocuments: number;
      documentsWithEmbeddings: number;
      totalChunks: number;
      chunksCompleted: number;
      chunksPending: number;
      chunksFailed: number;
      completionPercentage: number;
    };
    recentDocuments: Array<{
      documentId: string;
      filename: string;
      uploadedAt: number;
      chunkCount: number;
      embeddingsGenerated: number;
      status: string;
    }>;
    failedChunks: Array<{
      chunkId: number;
      documentId: string;
      chunkIndex: number;
      error: string;
    }>;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Getting embedding status dashboard', { adminUserId });

    // Summary statistics
    const summaryResult = await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        SELECT
          COUNT(*) as totalChunks,
          SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN embedding_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM document_chunks
      `)
      .first();

    // Document counts
    const docCountResult = await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        SELECT
          COUNT(*) as totalDocuments,
          SUM(CASE WHEN embeddings_generated > 0 THEN 1 ELSE 0 END) as documentsWithEmbeddings
        FROM documents
      `)
      .first();

    // Recent documents with embedding progress
    const recentDocsResult = await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        SELECT
          id,
          filename,
          uploaded_at,
          chunk_count,
          embeddings_generated,
          vector_indexing_status
        FROM documents
        ORDER BY uploaded_at DESC
        LIMIT 20
      `)
      .all();

    // Failed chunks for debugging
    const failedChunksResult = await (this.env.AUDITGUARD_DB as any)
      .prepare(`
        SELECT id, document_id, chunk_index
        FROM document_chunks
        WHERE embedding_status = 'failed'
        LIMIT 50
      `)
      .all();

    const totalChunks = summaryResult?.totalChunks || 0;
    const completed = summaryResult?.completed || 0;
    const completionPercentage = totalChunks ? Math.round((completed / totalChunks) * 100) : 0;

    await this.logAdminAction(adminUserId, 'view_embedding_status', 'embeddings', null, {
      totalChunks,
      completed,
      completionPercentage,
    });

    this.env.logger.info('Embedding status retrieved', {
      adminUserId,
      totalChunks,
      completed,
      pending: summaryResult?.pending || 0,
      failed: summaryResult?.failed || 0,
    });

    return {
      summary: {
        totalDocuments: docCountResult?.totalDocuments || 0,
        documentsWithEmbeddings: docCountResult?.documentsWithEmbeddings || 0,
        totalChunks,
        chunksCompleted: completed,
        chunksPending: summaryResult?.pending || 0,
        chunksFailed: summaryResult?.failed || 0,
        completionPercentage,
      },
      recentDocuments: (recentDocsResult.results || []).map((d: any) => ({
        documentId: d.id,
        filename: d.filename,
        uploadedAt: d.uploaded_at,
        chunkCount: d.chunk_count,
        embeddingsGenerated: d.embeddings_generated,
        status: d.vector_indexing_status,
      })),
      failedChunks: (failedChunksResult.results || []).map((c: any) => ({
        chunkId: c.id,
        documentId: c.document_id,
        chunkIndex: c.chunk_index,
        error: 'Check error logs for details',
      })),
    };
  }

  /**
   * Phase 2.3: Test vector search functionality
   */
  async testVectorSearch(
    adminUserId: string,
    query: string,
    topK: number = 5
  ): Promise<{
    query: string;
    results: Array<{
      vectorId: string;
      score: number;
      documentId: string;
      chunkIndex: number;
      text: string;
    }>;
    searchTime: number;
    error?: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Testing vector search', { adminUserId, query, topK });

    const startTime = Date.now();

    try {
      // For now, return a placeholder response since we need the embedding service
      // In production, this would call the embedding service to generate query vector
      // and then query the vector index

      // Check if we have any completed embeddings first
      const hasEmbeddingsResult = await (this.env.AUDITGUARD_DB as any)
        .prepare(`SELECT COUNT(*) as count FROM document_chunks WHERE embedding_status = 'completed'`)
        .first();

      const hasEmbeddings = (hasEmbeddingsResult?.count || 0) > 0;

      if (!hasEmbeddings) {
        const searchTime = Date.now() - startTime;
        return {
          query,
          results: [],
          searchTime,
          error: 'No embeddings available yet. Upload documents and wait for embedding generation.',
        };
      }

      // Try to query the vector index directly
      // This requires the embedding service to convert the query to a vector
      // For now, we'll return a diagnostic message

      await this.logAdminAction(adminUserId, 'test_vector_search', 'vector_index', null, {
        query,
        topK,
      });

      const searchTime = Date.now() - startTime;

      return {
        query,
        results: [],
        searchTime,
        error: 'Vector search requires embedding service integration. Use document search API for now.',
      };

    } catch (error) {
      const searchTime = Date.now() - startTime;

      this.env.logger.error('Vector search test failed', {
        adminUserId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        query,
        results: [],
        searchTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Phase 2.4: Check Python embedding service health
   */
  async getEmbeddingServiceHealth(adminUserId: string): Promise<{
    url: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    modelName: string;
    dimensions: number;
    totalRequests: number;
    totalEmbeddings: number;
    totalErrors: number;
    avgLatencyMs: number;
    lastChecked: number;
    error?: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const serviceUrl = this.env.LOCAL_EMBEDDING_SERVICE_URL || 'http://localhost:8080';

    this.env.logger.info('Checking embedding service health', {
      adminUserId,
      serviceUrl,
    });

    try {
      // Check /health endpoint with 5 second timeout
      const healthResponse = await fetch(`${serviceUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!healthResponse.ok) {
        await this.logAdminAction(adminUserId, 'view_service_health', 'embedding_service', null, {
          status: 'unhealthy',
          statusCode: healthResponse.status,
        });

        return {
          url: serviceUrl,
          status: 'unhealthy',
          modelName: 'unknown',
          dimensions: 0,
          totalRequests: 0,
          totalEmbeddings: 0,
          totalErrors: 0,
          avgLatencyMs: 0,
          lastChecked: Date.now(),
          error: `Service returned status ${healthResponse.status}`,
        };
      }

      // Try to get metrics
      let metrics: any = {};
      try {
        const metricsResponse = await fetch(`${serviceUrl}/metrics`, {
          signal: AbortSignal.timeout(5000),
        });
        if (metricsResponse.ok) {
          metrics = await metricsResponse.json();
        }
      } catch (metricsError) {
        // Metrics endpoint might not exist, that's okay
        this.env.logger.warn('Could not fetch metrics', {
          error: metricsError instanceof Error ? metricsError.message : String(metricsError),
        });
      }

      await this.logAdminAction(adminUserId, 'view_service_health', 'embedding_service', null, {
        status: 'healthy',
      });

      this.env.logger.info('Embedding service is healthy', {
        adminUserId,
        serviceUrl,
      });

      return {
        url: serviceUrl,
        status: 'healthy',
        modelName: metrics.model_name || 'all-MiniLM-L6-v2',
        dimensions: metrics.dimensions || 384,
        totalRequests: metrics.total_requests || 0,
        totalEmbeddings: metrics.total_embeddings || 0,
        totalErrors: metrics.total_errors || 0,
        avgLatencyMs: metrics.avg_latency_ms || 0,
        lastChecked: Date.now(),
      };

    } catch (error) {
      await this.logAdminAction(adminUserId, 'view_service_health', 'embedding_service', null, {
        status: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });

      this.env.logger.error('Could not connect to embedding service', {
        adminUserId,
        serviceUrl,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        url: serviceUrl,
        status: 'unknown',
        modelName: 'unknown',
        dimensions: 0,
        totalRequests: 0,
        totalEmbeddings: 0,
        totalErrors: 0,
        avgLatencyMs: 0,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : 'Could not connect to service',
      };
    }
  }

  // ====== PHASE 3: SMARTBUCKET MANAGEMENT ======

  /**
   * Helper: Get bucket by name
   */
  private getBucket(name: string): any {
    switch (name) {
      case 'documents-bucket':
        return this.env.DOCUMENTS_BUCKET;
      default:
        return null;
    }
  }

  /**
   * Phase 3.1: List all objects in a SmartBucket
   */
  async listBucketObjects(
    adminUserId: string,
    bucketName: string,
    options: {
      prefix?: string;
      limit?: number;
      continuationToken?: string;
    } = {}
  ): Promise<{
    objects: Array<{
      key: string;
      size: number;
      lastModified: string;
      contentType: string;
      metadata?: Record<string, any>;
    }>;
    totalCount: number;
    continuationToken?: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const bucket = this.getBucket(bucketName);
    if (!bucket) {
      throw new Error(`Bucket "${bucketName}" not found`);
    }

    this.env.logger.info('Listing bucket objects', {
      adminUserId,
      bucketName,
      prefix: options.prefix,
    });

    try {
      // List objects using Raindrop SmartBucket API
      const result = await bucket.list({
        prefix: options.prefix,
        limit: options.limit || 100,
      });

      await this.logAdminAction(adminUserId, 'list_bucket_objects', 'smartbucket', bucketName, {
        objectCount: result.objects?.length || 0,
        prefix: options.prefix,
      });

      this.env.logger.info('Bucket objects listed', {
        adminUserId,
        bucketName,
        count: result.objects?.length || 0,
      });

      return {
        objects: (result.objects || []).map((obj: any) => ({
          key: obj.key,
          size: obj.size || 0,
          lastModified: obj.uploaded || obj.lastModified || new Date().toISOString(),
          contentType: obj.httpMetadata?.contentType || 'unknown',
          metadata: obj.customMetadata || {},
        })),
        totalCount: result.objects?.length || 0,
        continuationToken: result.cursor,
      };
    } catch (error) {
      this.env.logger.error('Failed to list bucket objects', {
        adminUserId,
        bucketName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Phase 3.2: Get detailed information about a specific object
   */
  async getBucketObject(
    adminUserId: string,
    bucketName: string,
    key: string
  ): Promise<{
    key: string;
    content: string;
    metadata: Record<string, any>;
    size: number;
    contentType: string;
    indexed: boolean;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const bucket = this.getBucket(bucketName);
    if (!bucket) {
      throw new Error(`Bucket "${bucketName}" not found`);
    }

    this.env.logger.info('Getting bucket object', {
      adminUserId,
      bucketName,
      key,
    });

    try {
      // Get object
      const object = await bucket.get(key);
      if (!object) {
        throw new Error(`Object "${key}" not found`);
      }

      // Read the body
      const content = await object.text();

      await this.logAdminAction(adminUserId, 'view_bucket_object', 'smartbucket', bucketName, {
        key,
        size: object.size || 0,
      });

      this.env.logger.info('Bucket object retrieved', {
        adminUserId,
        bucketName,
        key,
        size: object.size || 0,
      });

      return {
        key,
        content,
        metadata: object.customMetadata || {},
        size: object.size || 0,
        contentType: object.httpMetadata?.contentType || 'unknown',
        indexed: false, // Would need SmartBucket search to determine
      };
    } catch (error) {
      this.env.logger.error('Failed to get bucket object', {
        adminUserId,
        bucketName,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Phase 3.3: Delete object(s) from SmartBucket
   */
  async deleteBucketObjects(
    adminUserId: string,
    bucketName: string,
    keys: string[]
  ): Promise<{
    deleted: string[];
    failed: Array<{ key: string; error: string }>;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const bucket = this.getBucket(bucketName);
    if (!bucket) {
      throw new Error(`Bucket "${bucketName}" not found`);
    }

    this.env.logger.info('Deleting bucket objects', {
      adminUserId,
      bucketName,
      keyCount: keys.length,
    });

    const deleted: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    for (const key of keys) {
      try {
        await bucket.delete(key);
        deleted.push(key);
      } catch (error) {
        failed.push({
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.logAdminAction(adminUserId, 'delete_bucket_objects', 'smartbucket', bucketName, {
      deletedCount: deleted.length,
      failedCount: failed.length,
      keys: deleted,
    });

    this.env.logger.info('Bucket objects deleted', {
      adminUserId,
      bucketName,
      deletedCount: deleted.length,
      failedCount: failed.length,
    });

    return { deleted, failed };
  }

  /**
   * Phase 3.4: Search SmartBucket content
   */
  async searchBucket(
    adminUserId: string,
    bucketName: string,
    query: string,
    limit: number = 10
  ): Promise<{
    results: Array<{
      key: string;
      score: number;
      text: string;
      metadata: Record<string, any>;
    }>;
    totalResults: number;
    searchTime: number;
    error?: string;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const bucket = this.getBucket(bucketName);
    if (!bucket) {
      throw new Error(`Bucket "${bucketName}" not found`);
    }

    this.env.logger.info('Searching bucket', {
      adminUserId,
      bucketName,
      query,
      limit,
    });

    const startTime = Date.now();

    try {
      // SmartBucket search method
      const searchResult = await bucket.search({
        query,
        limit,
      });

      const searchTime = Date.now() - startTime;

      await this.logAdminAction(adminUserId, 'search_bucket', 'smartbucket', bucketName, {
        query,
        resultCount: searchResult.results?.length || 0,
        searchTime,
      });

      this.env.logger.info('Bucket search completed', {
        adminUserId,
        bucketName,
        query,
        resultCount: searchResult.results?.length || 0,
        searchTime,
      });

      return {
        results: (searchResult.results || []).map((r: any) => ({
          key: r.key || '',
          score: r.score || 0,
          text: r.text || '',
          metadata: r.metadata || {},
        })),
        totalResults: searchResult.results?.length || 0,
        searchTime,
      };
    } catch (error) {
      const searchTime = Date.now() - startTime;

      this.env.logger.error('Bucket search failed', {
        adminUserId,
        bucketName,
        query,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        results: [],
        totalResults: 0,
        searchTime,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }

  /**
   * Phase 3.5: Clean up orphaned SmartBucket objects (not referenced in database)
   */
  async cleanupOrphanedObjects(
    adminUserId: string,
    bucketName: string,
    dryRun: boolean = true
  ): Promise<{
    orphanedKeys: string[];
    deletedKeys: string[];
    totalSize: number;
    dryRun: boolean;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    const bucket = this.getBucket(bucketName);
    if (!bucket) {
      throw new Error(`Bucket "${bucketName}" not found`);
    }

    this.env.logger.info('Starting orphaned objects cleanup', {
      adminUserId,
      bucketName,
      dryRun,
    });

    try {
      // List all objects in bucket
      const allObjects = await bucket.list({ limit: 10000 });

      // Get all valid keys from database
      const documentsResult = await (this.env.AUDITGUARD_DB as any)
        .prepare(`SELECT vultr_key, extracted_text_key FROM documents`)
        .all();

      const validKeySet = new Set<string>();
      (documentsResult.results || []).forEach((d: any) => {
        if (d.vultr_key) validKeySet.add(d.vultr_key);
        if (d.extracted_text_key) validKeySet.add(d.extracted_text_key);
      });

      // Find orphaned objects
      const orphanedObjects = (allObjects.objects || []).filter(
        (obj: any) => !validKeySet.has(obj.key)
      );

      const orphanedKeys = orphanedObjects.map((o: any) => o.key);
      const totalSize = orphanedObjects.reduce((sum: number, o: any) => sum + (o.size || 0), 0);

      let deletedKeys: string[] = [];

      if (!dryRun && orphanedKeys.length > 0) {
        // Actually delete orphaned objects
        const result = await this.deleteBucketObjects(adminUserId, bucketName, orphanedKeys);
        deletedKeys = result.deleted;
      }

      await this.logAdminAction(adminUserId, 'cleanup_orphaned_objects', 'smartbucket', bucketName, {
        orphanedCount: orphanedKeys.length,
        deletedCount: deletedKeys.length,
        totalSize,
        dryRun,
      });

      this.env.logger.info('Orphaned objects cleanup completed', {
        adminUserId,
        bucketName,
        orphanedCount: orphanedKeys.length,
        deletedCount: deletedKeys.length,
        totalSize,
        dryRun,
      });

      return {
        orphanedKeys,
        deletedKeys,
        totalSize,
        dryRun,
      };
    } catch (error) {
      this.env.logger.error('Orphaned objects cleanup failed', {
        adminUserId,
        bucketName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
