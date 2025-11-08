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

    this.env.logger.info('Getting vector index statistics from D1', { adminUserId });

    try {
      const db = this.getDb();

      // Get chunk statistics from D1 database using raw SQL
      const chunkStats = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM document_chunks`
      ).first();

      const totalVectors = Number(chunkStats?.total || 0);
      const completedVectors = Number(chunkStats?.completed || 0);

      // Get sample vectors from recent documents
      const recentChunks = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
          dc.id,
          dc.document_id,
          dc.chunk_index,
          dc.embedding_status,
          dc.vector_id,
          d.filename
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        ORDER BY dc.created_at DESC
        LIMIT 10`
      ).all();

      const sampleVectors = (recentChunks.results || []).map((chunk: any) => ({
        id: chunk.vector_id || `${chunk.document_id}_chunk_${chunk.chunk_index}`,
        documentId: chunk.document_id,
        chunkIndex: chunk.chunk_index,
        hasEmbedding: chunk.embedding_status === 'completed',
        embeddingStatus: chunk.embedding_status || 'pending',
      }));

      await this.logAdminAction(adminUserId, 'view_vector_stats', 'vector_index', null, {
        totalVectors: completedVectors,
        databaseVectors: totalVectors,
        source: 'raindrop_d1',
      });

      this.env.logger.info('Vector index statistics retrieved from D1', {
        adminUserId,
        totalVectors: totalVectors,
        completedVectors: completedVectors,
        sampleCount: sampleVectors.length,
      });

      return {
        indexName: 'document-embeddings',
        dimensions: 384, // bge-small-en produces 384-dimensional vectors
        metric: 'cosine', // Raindrop Vector Index uses cosine similarity
        totalVectors: completedVectors,
        databaseVectors: totalVectors,
        mismatch: 0, // D1 is single source of truth
        sampleVectors,
      };
    } catch (error) {
      this.env.logger.error('Failed to get vector stats from D1', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to retrieve vector statistics from D1');
    }
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

    this.env.logger.info('Getting embedding status dashboard from D1', { adminUserId });

    try {
      // Get document statistics using raw SQL
      const docStats = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN embeddings_generated = 1 THEN 1 ELSE 0 END) as withEmbeddings
        FROM documents`
      ).first();

      const totalDocs = Number(docStats?.total || 0);
      const docsWithEmbeddings = Number(docStats?.withEmbeddings || 0);

      // Get chunk statistics using raw SQL to avoid type issues
      const chunksStats = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN embedding_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM document_chunks`
      ).first();

      const totalChunks = Number(chunksStats?.total || 0);
      const chunksCompleted = Number(chunksStats?.completed || 0);
      const chunksPending = Number(chunksStats?.pending || 0);
      const chunksFailed = Number(chunksStats?.failed || 0);
      const completionPercentage = totalChunks > 0 ? Math.round((chunksCompleted / totalChunks) * 100) : 0;

      // Get recent documents with embedding counts
      const recentDocs = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
          d.id,
          d.filename,
          d.uploaded_at,
          d.chunk_count,
          COUNT(CASE WHEN dc.embedding_status = 'completed' THEN 1 END) as embeddings_generated,
          CASE
            WHEN COUNT(CASE WHEN dc.embedding_status = 'completed' THEN 1 END) = d.chunk_count THEN 'completed'
            WHEN COUNT(CASE WHEN dc.embedding_status = 'completed' THEN 1 END) > 0 THEN 'partial'
            ELSE 'pending'
          END as status
        FROM documents d
        LEFT JOIN document_chunks dc ON d.id = dc.document_id
        GROUP BY d.id
        ORDER BY d.uploaded_at DESC
        LIMIT 10`
      ).all();

      // Get failed chunks
      const failedChunksData = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, document_id, chunk_index
        FROM document_chunks
        WHERE embedding_status = 'failed'
        LIMIT 50`
      ).all();

      const failedChunks = (failedChunksData.results || []).map((c: any) => ({
        chunkId: c.id,
        documentId: c.document_id,
        chunkIndex: c.chunk_index,
        error: 'Embedding generation failed - check logs',
      }));

      await this.logAdminAction(adminUserId, 'view_embedding_status', 'embeddings', null, {
        totalChunks,
        completed: chunksCompleted,
        completionPercentage,
        source: 'raindrop_d1',
      });

      this.env.logger.info('Embedding status retrieved from D1', {
        adminUserId,
        totalChunks,
        completed: chunksCompleted,
        pending: chunksPending,
        failed: chunksFailed,
      });

      return {
        summary: {
          totalDocuments: totalDocs,
          documentsWithEmbeddings: docsWithEmbeddings,
          totalChunks,
          chunksCompleted,
          chunksPending,
          chunksFailed,
          completionPercentage,
        },
        recentDocuments: (recentDocs.results || []).map((d: any) => ({
          documentId: d.id,
          filename: d.filename,
          uploadedAt: d.uploaded_at,
          chunkCount: d.chunk_count,
          embeddingsGenerated: Number(d.embeddings_generated || 0),
          status: d.status,
        })),
        failedChunks,
      };
    } catch (error) {
      this.env.logger.error('Failed to get embedding status from D1', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to retrieve embedding status from D1');
    }
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

    this.env.logger.info('Testing vector search using Raindrop AI + Vector Index', { adminUserId, query, topK });

    const startTime = Date.now();

    try {
      // Generate query embedding using Raindrop AI
      const queryEmbeddingResponse = await this.env.AI.run('bge-small-en', {
        text: [query]
      } as any);

      const queryEmbedding = Array.isArray(queryEmbeddingResponse)
        ? queryEmbeddingResponse[0]
        : (queryEmbeddingResponse as any).data[0];

      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 384) {
        throw new Error('Invalid query embedding generated');
      }

      // Query Raindrop Vector Index
      const vectorResults = await this.env.DOCUMENT_EMBEDDINGS.query(queryEmbedding, {
        topK,
        returnMetadata: 'all',
      });

      const searchTime = Date.now() - startTime;

      // Format results
      const results = (vectorResults.matches || []).map((match: any) => ({
        vectorId: match.id,
        score: match.score,
        documentId: match.metadata?.documentId || 'unknown',
        chunkIndex: match.metadata?.chunkIndex || 0,
        text: (match.metadata?.text || 'No text available').substring(0, 500), // Truncate text for response size
      }));

      // Log the search test
      await this.logAdminAction(adminUserId, 'test_vector_search', 'vector_index', null, {
        query,
        topK,
        resultsCount: results.length,
        searchTimeMs: searchTime,
        source: 'raindrop_vector_index',
      });

      this.env.logger.info('Vector search test completed using Raindrop', {
        adminUserId,
        query,
        resultsCount: results.length,
        searchTimeMs: searchTime,
      });

      return {
        query,
        results,
        searchTime,
      };

    } catch (error) {
      const searchTime = Date.now() - startTime;

      this.env.logger.error('Raindrop vector search test failed', {
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

    this.env.logger.info('Checking Raindrop AI embedding service health', {
      adminUserId,
    });

    try {
      // Test Raindrop AI with a simple embedding request
      const testText = 'Health check test';
      const startTime = Date.now();

      const response = await this.env.AI.run('bge-small-en', {
        text: [testText]
      } as any);

      const latency = Date.now() - startTime;

      // Validate response
      const embedding = Array.isArray(response) ? response[0] : (response as any).data?.[0];

      if (!Array.isArray(embedding) || embedding.length !== 384) {
        throw new Error(`Invalid embedding: expected 384 dimensions, got ${embedding?.length}`);
      }

      // Get usage statistics from D1
      const stats = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT
          COUNT(*) as total_chunks,
          SUM(CASE WHEN embedding_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM document_chunks`
      ).first();

      await this.logAdminAction(adminUserId, 'view_service_health', 'embedding_service', null, {
        status: 'healthy',
        model: 'bge-small-en',
        latencyMs: latency,
        source: 'raindrop_ai',
      });

      this.env.logger.info('Raindrop AI health check passed', {
        adminUserId,
        model: 'bge-small-en',
        latencyMs: latency,
        dimensions: 384,
        totalEmbeddings: stats?.completed || 0,
      });

      return {
        url: 'Raindrop AI (native)',
        status: 'healthy',
        modelName: 'bge-small-en',
        dimensions: 384,
        totalRequests: Number(stats?.total_chunks || 0),
        totalEmbeddings: Number(stats?.completed || 0),
        totalErrors: Number(stats?.failed || 0),
        avgLatencyMs: latency,
        lastChecked: Date.now(),
      };

    } catch (error) {
      await this.logAdminAction(adminUserId, 'view_service_health', 'embedding_service', null, {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        source: 'raindrop_ai',
      });

      this.env.logger.error('Raindrop AI health check failed', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        url: 'Raindrop AI (native)',
        status: 'unhealthy',
        modelName: 'bge-small-en',
        dimensions: 384,
        totalRequests: 0,
        totalEmbeddings: 0,
        totalErrors: 0,
        avgLatencyMs: 0,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : String(error),
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

  /**
   * Phase 4.1: Get application error logs
   */
  async getErrorLogs(
    adminUserId: string,
    options: {
      startTime?: number;
      endTime?: number;
      service?: string;
      severity?: 'error' | 'warn' | 'info';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    logs: Array<{
      id: string;
      timestamp: number;
      service: string;
      severity: string;
      message: string;
      error?: string;
      stack?: string;
      context?: Record<string, any>;
    }>;
    totalCount: number;
    hasMore: boolean;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Fetching error logs', {
      adminUserId,
      options,
    });

    try {
      const limit = options.limit || 100;
      const offset = options.offset || 0;

      // Note: performance_metrics table doesn't exist yet
      // For now, return empty logs with proper structure
      // TODO: Create performance_metrics table or use logging service

      const logs: any[] = [];
      const totalCount = 0;

      await this.logAdminAction(adminUserId, 'view_error_logs', 'system', null, {
        totalCount,
        limit,
        offset,
        filters: options,
      });

      this.env.logger.info('Error logs retrieved', {
        adminUserId,
        totalCount,
        returnedCount: logs.length,
      });

      return {
        logs,
        totalCount,
        hasMore: offset + logs.length < totalCount,
      };
    } catch (error) {
      this.env.logger.error('Failed to fetch error logs', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to retrieve error logs');
    }
  }

  /**
   * Phase 4.2: Get overall system health dashboard
   */
  async getSystemHealth(adminUserId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      uptime: number;
      lastCheck: number;
      errorRate: number;
      avgLatency: number;
      details?: Record<string, any>;
    }>;
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      connectionPool: {
        active: number;
        idle: number;
        total: number;
      };
      slowQueries: number;
      avgQueryTime: number;
    };
    embeddingService: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      url: string;
      modelName: string;
      totalRequests: number;
      errorRate: number;
      avgLatency: number;
    };
    metrics: {
      totalErrors24h: number;
      errorRate24h: number;
      avgResponseTime24h: number;
      requestsPerMinute: number;
      // Legacy fields for backwards compatibility
      totalRequests: number;
      avgResponseTime: number;
      errorRate: number;
      uptime: number;
    };
    alerts: Array<{
      severity: 'warning' | 'error' | 'critical';
      service: string;
      message: string;
      timestamp: number;
    }>;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Fetching system health', { adminUserId });

    try {
      const now = Date.now();
      const last24h = now - 24 * 60 * 60 * 1000;

      // Get embedding service health
      const embeddingHealth = await this.getEmbeddingServiceHealth(adminUserId);

      // Get real metrics from performance_metrics table
      const metricsResult = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT
            COUNT(*) as total_requests,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as total_errors,
            AVG(duration) as avg_duration
          FROM performance_metrics
          WHERE created_at >= ?1
        `)
        .bind(last24h)
        .first();

      const totalRequests = metricsResult?.total_requests || 0;
      const totalErrors = metricsResult?.total_errors || 0;
      const avgDuration = metricsResult?.avg_duration || 0;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      // Get service-specific metrics from performance_metrics
      const serviceMetrics = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT
            operation,
            COUNT(*) as request_count,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count,
            AVG(duration) as avg_latency
          FROM performance_metrics
          WHERE created_at >= ?1
          GROUP BY operation
          ORDER BY request_count DESC
          LIMIT 20
        `)
        .bind(last24h)
        .all();

      // Build services health status
      const services = (serviceMetrics.results || []).map((metric: any) => {
        const serviceName = metric.operation?.split(':')[0] || 'unknown';
        const requestCount = metric.request_count || 0;
        const errorCount = metric.error_count || 0;
        const serviceErrorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
        const avgLatency = metric.avg_latency || 0;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (serviceErrorRate > 10 || avgLatency > 5000) {
          status = 'unhealthy';
        } else if (serviceErrorRate > 5 || avgLatency > 2000) {
          status = 'degraded';
        }

        return {
          name: serviceName,
          status,
          uptime: 99.9, // Placeholder - would need actual uptime tracking
          lastCheck: now,
          errorRate: serviceErrorRate,
          avgLatency,
          details: {
            requestCount,
            errorCount,
          },
        };
      });

      // Database health (simplified - D1 doesn't expose connection pool stats)
      const database = {
        status: 'healthy' as const,
        connectionPool: {
          active: 0,
          idle: 0,
          total: 1,
        },
        slowQueries: 0,
        avgQueryTime: avgDuration,
      };

      // Embedding service status
      // Map 'unknown' status to 'degraded' for system health
      const embeddingServiceStatus: 'healthy' | 'degraded' | 'unhealthy' =
        embeddingHealth.status === 'unknown' ? 'degraded' : embeddingHealth.status;

      const embeddingService = {
        status: embeddingServiceStatus,
        url: embeddingHealth.url,
        modelName: embeddingHealth.modelName,
        totalRequests: embeddingHealth.totalRequests,
        errorRate: embeddingHealth.totalErrors > 0
          ? (embeddingHealth.totalErrors / embeddingHealth.totalRequests) * 100
          : 0,
        avgLatency: embeddingHealth.avgLatencyMs,
      };

      // Generate alerts based on health data
      const alerts: any[] = [];

      if (errorRate > 10) {
        alerts.push({
          severity: 'critical',
          service: 'system',
          message: `High error rate: ${errorRate.toFixed(2)}% (last 24h)`,
          timestamp: now,
        });
      } else if (errorRate > 5) {
        alerts.push({
          severity: 'warning',
          service: 'system',
          message: `Elevated error rate: ${errorRate.toFixed(2)}% (last 24h)`,
          timestamp: now,
        });
      }

      if (embeddingServiceStatus === 'unhealthy') {
        alerts.push({
          severity: 'critical',
          service: 'embedding-service',
          message: 'Embedding service is unhealthy',
          timestamp: now,
        });
      } else if (embeddingServiceStatus === 'degraded') {
        alerts.push({
          severity: 'warning',
          service: 'embedding-service',
          message: 'Embedding service is degraded or unknown',
          timestamp: now,
        });
      }

      // Determine overall system status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const unhealthyServices = services.filter((s) => s.status === 'unhealthy').length;
      const degradedServices = services.filter((s) => s.status === 'degraded').length;

      if (unhealthyServices > 0 || embeddingServiceStatus === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (degradedServices > 1 || embeddingServiceStatus === 'degraded') {
        overallStatus = 'degraded';
      }

      await this.logAdminAction(adminUserId, 'view_system_health', 'system', null, {
        status: overallStatus,
        totalErrors24h: totalErrors,
        errorRate,
      });

      this.env.logger.info('System health retrieved', {
        adminUserId,
        status: overallStatus,
        totalErrors24h: totalErrors,
      });

      return {
        status: overallStatus,
        services,
        database,
        embeddingService,
        metrics: {
          // Detailed metrics
          totalErrors24h: totalErrors,
          errorRate24h: errorRate,
          avgResponseTime24h: avgDuration,
          requestsPerMinute: totalRequests / (24 * 60),
          // Legacy fields for backwards compatibility
          totalRequests,
          avgResponseTime: avgDuration,
          errorRate,
          uptime: 604800, // 7 days in seconds (placeholder - would need actual app start time tracking)
        },
        alerts,
      };
    } catch (error) {
      this.env.logger.error('Failed to fetch system health', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to retrieve system health');
    }
  }

  /**
   * Phase 4.3: Get performance metrics viewer
   */
  async getPerformanceMetrics(
    adminUserId: string,
    options: {
      startTime?: number;
      endTime?: number;
      operation?: string;
      groupBy?: 'hour' | 'day' | 'operation';
      limit?: number;
    } = {}
  ): Promise<{
    metrics: Array<{
      timestamp?: number;
      operation?: string;
      requestCount: number;
      successCount: number;
      errorCount: number;
      errorRate: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      p50Duration?: number;
      p95Duration?: number;
      p99Duration?: number;
    }>;
    summary: {
      totalRequests: number;
      totalErrors: number;
      overallErrorRate: number;
      avgDuration: number;
      timeRange: {
        start: number;
        end: number;
      };
    };
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Fetching performance metrics', {
      adminUserId,
      options,
    });

    try {
      const now = Date.now();
      const startTime = options.startTime || now - 24 * 60 * 60 * 1000; // Default: last 24h
      const endTime = options.endTime || now;

      // Query performance_metrics table
      let query = `
        SELECT
          operation,
          COUNT(*) as requestCount,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errorCount,
          AVG(duration) as avgDuration,
          MIN(duration) as minDuration,
          MAX(duration) as maxDuration
        FROM performance_metrics
        WHERE created_at >= ?1 AND created_at <= ?2
      `;

      const params: any[] = [startTime, endTime];

      if (options.operation) {
        query += ` AND operation = ?${params.length + 1}`;
        params.push(options.operation);
      }

      query += ` GROUP BY operation ORDER BY requestCount DESC`;

      if (options.limit) {
        query += ` LIMIT ?${params.length + 1}`;
        params.push(options.limit);
      }

      const result = await (this.env.AUDITGUARD_DB as any)
        .prepare(query)
        .bind(...params)
        .all();

      const metrics = (result.results || []).map((row: any) => ({
        operation: row.operation,
        requestCount: row.requestCount || 0,
        successCount: row.successCount || 0,
        errorCount: row.errorCount || 0,
        errorRate: row.requestCount > 0 ? (row.errorCount / row.requestCount) * 100 : 0,
        avgDuration: row.avgDuration || 0,
        minDuration: row.minDuration || 0,
        maxDuration: row.maxDuration || 0,
      }));

      const totalRequests = metrics.reduce((sum, m) => sum + m.requestCount, 0);
      const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
      const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      await this.logAdminAction(adminUserId, 'view_performance_metrics', 'system', null, {
        groupBy: options.groupBy,
        operation: options.operation,
        metricsCount: metrics.length,
      });

      this.env.logger.info('Performance metrics retrieved', {
        adminUserId,
        totalRequests,
        metricsCount: metrics.length,
      });

      return {
        metrics,
        summary: {
          totalRequests,
          totalErrors,
          overallErrorRate,
          avgDuration: 0,
          timeRange: {
            start: startTime,
            end: endTime,
          },
        },
      };
    } catch (error) {
      this.env.logger.error('Failed to fetch performance metrics', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to retrieve performance metrics');
    }
  }

  /**
   * Phase 5.1: Export database table to JSON/CSV
   */
  async exportTable(
    adminUserId: string,
    tableName: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<{
    filename: string;
    data: string;
    rowCount: number;
    size: number;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Exporting table', {
      adminUserId,
      tableName,
      format,
    });

    try {
      // Validate table exists
      const tableCheck = await (this.env.AUDITGUARD_DB as any)
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?1`)
        .bind(tableName)
        .first();

      if (!tableCheck) {
        throw new Error(`Table "${tableName}" does not exist`);
      }

      // Get all data from table (use quoted identifier for safety)
      const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;
      const result = await (this.env.AUDITGUARD_DB as any)
        .prepare(`SELECT * FROM ${quotedTableName}`)
        .all();

      const rows = result.results || [];

      let data: string;
      let filename: string;

      if (format === 'json') {
        data = JSON.stringify(rows, null, 2);
        filename = `${tableName}_${Date.now()}.json`;
      } else {
        // CSV format
        if (rows.length === 0) {
          data = '';
          filename = `${tableName}_${Date.now()}.csv`;
        } else {
          const headers = Object.keys(rows[0]);
          const csvRows = [
            headers.join(','),
            ...rows.map((row: any) =>
              headers.map((h) => {
                const value = row[h];
                // Escape quotes and wrap in quotes if contains comma or quote
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                  return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
              }).join(',')
            ),
          ];
          data = csvRows.join('\n');
          filename = `${tableName}_${Date.now()}.csv`;
        }
      }

      await this.logAdminAction(adminUserId, 'export_table', 'database', tableName, {
        format,
        rowCount: rows.length,
        size: data.length,
      });

      this.env.logger.info('Table exported successfully', {
        adminUserId,
        tableName,
        format,
        rowCount: rows.length,
        size: data.length,
      });

      return {
        filename,
        data,
        rowCount: rows.length,
        size: data.length,
      };
    } catch (error) {
      this.env.logger.error('Failed to export table', {
        adminUserId,
        tableName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Phase 5.2: Create full database backup
   */
  async createBackup(
    adminUserId: string,
    options: {
      includeTables?: string[];
      excludeTables?: string[];
    } = {}
  ): Promise<{
    backupId: string;
    filename: string;
    tables: string[];
    totalSize: number;
    rowCounts: Record<string, number>;
    created: number;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Creating database backup', {
      adminUserId,
      options,
    });

    try {
      const backupId = `backup_${Date.now()}`;
      const created = Date.now();

      // Get list of all tables (exclude internal Cloudflare and SQLite tables)
      const tablesResult = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table'
          AND name NOT LIKE '_cf_%'
          AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `)
        .all();

      let tables = (tablesResult.results || []).map((t: any) => t.name);

      // Filter tables based on options
      if (options.includeTables && options.includeTables.length > 0) {
        tables = tables.filter((t: string) => options.includeTables!.includes(t));
      }

      if (options.excludeTables && options.excludeTables.length > 0) {
        tables = tables.filter((t: string) => !options.excludeTables!.includes(t));
      }

      // Export each table
      const backup: Record<string, any[]> = {};
      const rowCounts: Record<string, number> = {};
      let totalSize = 0;

      for (const table of tables) {
        // Use quoted identifier for safety
        const quotedTableName = `"${table.replace(/"/g, '""')}"`;
        const result = await (this.env.AUDITGUARD_DB as any)
          .prepare(`SELECT * FROM ${quotedTableName}`)
          .all();

        const rows = result.results || [];
        backup[table] = rows;
        rowCounts[table] = rows.length;
      }

      const backupData = JSON.stringify(
        {
          backupId,
          created,
          tables,
          data: backup,
        },
        null,
        2
      );

      totalSize = backupData.length;

      await this.logAdminAction(adminUserId, 'create_backup', 'database', null, {
        backupId,
        tables,
        totalRows: Object.values(rowCounts).reduce((sum, count) => sum + count, 0),
        totalSize,
      });

      this.env.logger.info('Database backup created successfully', {
        adminUserId,
        backupId,
        tables,
        totalSize,
      });

      return {
        backupId,
        filename: `${backupId}.json`,
        tables,
        totalSize,
        rowCounts,
        created,
      };
    } catch (error) {
      this.env.logger.error('Failed to create backup', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Phase 5.3: Get list of available backups
   */
  async listBackups(adminUserId: string): Promise<{
    backups: Array<{
      backupId: string;
      created: number;
      createdBy: string;
      tables: string[];
      totalSize: number;
    }>;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Listing backups', { adminUserId });

    try {
      // Get backup entries from admin_audit_log
      const result = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT
            admin_user_id,
            metadata,
            created_at
          FROM admin_audit_log
          WHERE action = 'create_backup'
          ORDER BY created_at DESC
          LIMIT 50
        `)
        .all();

      const backups = (result.results || []).map((r: any) => {
        const metadata = r.metadata ? JSON.parse(r.metadata) : {};
        return {
          backupId: metadata.backupId || `backup_${r.created_at}`,
          created: r.created_at,
          createdBy: r.admin_user_id,
          tables: metadata.tables || [],
          totalSize: metadata.totalSize || 0,
        };
      });

      await this.logAdminAction(adminUserId, 'list_backups', 'database', null, {
        count: backups.length,
      });

      this.env.logger.info('Backups listed successfully', {
        adminUserId,
        count: backups.length,
      });

      return { backups };
    } catch (error) {
      this.env.logger.error('Failed to list backups', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Phase 5.4: Get database statistics for backup/migration planning
   */
  async getDatabaseStats(adminUserId: string): Promise<{
    tables: Array<{
      name: string;
      rowCount: number;
      columnCount: number;
      estimatedSize: number;
    }>;
    totalTables: number;
    totalRows: number;
    totalSize: number;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Getting database statistics', { adminUserId });

    try {
      // Get all tables (exclude internal Cloudflare and SQLite tables)
      const tablesResult = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table'
          AND name NOT LIKE '_cf_%'
          AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `)
        .all();

      const tableNames = (tablesResult.results || []).map((t: any) => t.name);
      const tables: Array<{
        name: string;
        rowCount: number;
        columnCount: number;
        estimatedSize: number;
      }> = [];

      let totalRows = 0;
      let totalSize = 0;

      for (const tableName of tableNames) {
        try {
          // Sanitize table name by wrapping in double quotes (SQLite identifier quoting)
          const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;

          // Get row count
          const countResult = await (this.env.AUDITGUARD_DB as any)
            .prepare(`SELECT COUNT(*) as count FROM ${quotedTableName}`)
            .first();

          const rowCount = countResult?.count || 0;

          // Get column count using PRAGMA
          const columnsResult = await (this.env.AUDITGUARD_DB as any)
            .prepare(`PRAGMA table_info(${quotedTableName})`)
            .all();

          const columnCount = (columnsResult.results || []).length;

          // Estimate size (rough approximation)
          const estimatedSize = rowCount * columnCount * 100; // ~100 bytes per cell

          tables.push({
            name: tableName,
            rowCount,
            columnCount,
            estimatedSize,
          });

          totalRows += rowCount;
          totalSize += estimatedSize;
        } catch (tableError) {
          // Log error but continue with other tables
          this.env.logger.warn('Failed to get stats for table', {
            tableName,
            error: tableError instanceof Error ? tableError.message : String(tableError),
          });
        }
      }

      await this.logAdminAction(adminUserId, 'view_database_stats', 'database', null, {
        totalTables: tables.length,
        totalRows,
      });

      this.env.logger.info('Database statistics retrieved', {
        adminUserId,
        totalTables: tables.length,
        totalRows,
      });

      return {
        tables,
        totalTables: tables.length,
        totalRows,
        totalSize,
      };
    } catch (error) {
      this.env.logger.error('Failed to get database statistics', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error('Failed to retrieve database statistics');
    }
  }

  /**
   * Phase 5.3: Get database migration history
   */
  async getMigrationStatus(adminUserId: string): Promise<{
    migrations: Array<{
      name: string;
      version: number;
      appliedAt: number | null;
      status: 'applied' | 'pending';
      description: string;
    }>;
    currentVersion: number;
    pendingMigrations: number;
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Getting migration status', { adminUserId });

    try {
      // Known migrations list (in Cloudflare Workers we can't read filesystem)
      // This should be updated whenever new migrations are added
      const knownMigrations = [
        { version: 1, name: '001_initial_schema', description: 'Initial database schema' },
        { version: 2, name: '002_add_sessions', description: 'Add sessions table' },
        { version: 3, name: '003_add_workspaces', description: 'Add workspaces and members tables' },
        { version: 4, name: '004_add_documents', description: 'Add documents and chunks tables' },
        { version: 5, name: '005_add_compliance', description: 'Add compliance checks and frameworks' },
        { version: 6, name: '006_add_billing', description: 'Add subscriptions and billing tables' },
        { version: 7, name: '007_add_admin', description: 'Add admin users and audit log tables' },
        { version: 8, name: '008_add_embeddings', description: 'Add embeddings queue and vector metadata' },
      ];

      // Check which tables exist to determine which migrations have been applied
      const tablesResult = await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table'
          AND name NOT LIKE '_cf_%'
          AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `)
        .all();

      const existingTables = new Set(
        (tablesResult.results || []).map((t: any) => t.name)
      );

      // Map migrations to status based on table existence
      const migrations = knownMigrations.map((migration) => {
        let isApplied = false;

        // Simple heuristic: check if key tables from each migration exist
        switch (migration.version) {
          case 1: // Initial schema
            isApplied = existingTables.has('users');
            break;
          case 2: // Sessions
            isApplied = existingTables.has('sessions');
            break;
          case 3: // Workspaces
            isApplied = existingTables.has('workspaces') && existingTables.has('workspace_members');
            break;
          case 4: // Documents
            isApplied = existingTables.has('documents') && existingTables.has('document_chunks');
            break;
          case 5: // Compliance
            isApplied = existingTables.has('compliance_checks') && existingTables.has('compliance_frameworks');
            break;
          case 6: // Billing
            isApplied = existingTables.has('subscriptions') && existingTables.has('invoices');
            break;
          case 7: // Admin
            isApplied = existingTables.has('admin_users') && existingTables.has('admin_audit_log');
            break;
          case 8: // Embeddings
            isApplied = existingTables.has('embeddings_queue') && existingTables.has('vector_metadata');
            break;
          default:
            isApplied = false;
        }

        return {
          name: migration.name,
          version: migration.version,
          appliedAt: isApplied ? Date.now() : null, // We don't have actual timestamps
          status: isApplied ? ('applied' as const) : ('pending' as const),
          description: migration.description,
        };
      });

      // Calculate current version and pending count
      const appliedMigrations = migrations.filter((m) => m.status === 'applied');
      const currentVersion = appliedMigrations.length > 0
        ? Math.max(...appliedMigrations.map((m) => m.version))
        : 0;
      const pendingMigrations = migrations.filter((m) => m.status === 'pending').length;

      await this.logAdminAction(adminUserId, 'view_migration_status', 'database', null, {
        currentVersion,
        pendingMigrations,
      });

      this.env.logger.info('Migration status retrieved', {
        adminUserId,
        currentVersion,
        pendingMigrations,
      });

      return {
        migrations,
        currentVersion,
        pendingMigrations,
      };
    } catch (error) {
      this.env.logger.error('Failed to get migration status', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error('Failed to retrieve migration status');
    }
  }

  /**
   * Phase 5.4: Import data from JSON backup
   */
  async importBackup(
    adminUserId: string,
    backupData: string,
    options: {
      dryRun?: boolean;
      overwrite?: boolean;
      includeTables?: string[];
      excludeTables?: string[];
    } = {}
  ): Promise<{
    tables: Array<{
      name: string;
      rowsImported: number;
      status: 'success' | 'failed' | 'skipped';
      error?: string;
    }>;
    totalRows: number;
    dryRun: boolean;
    warnings: string[];
  }> {
    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new Error('Access denied');
    }

    this.env.logger.info('Importing backup', {
      adminUserId,
      dryRun: options.dryRun || false,
      overwrite: options.overwrite || false,
    });

    const results: Array<{
      name: string;
      rowsImported: number;
      status: 'success' | 'failed' | 'skipped';
      error?: string;
    }> = [];
    const warnings: string[] = [];
    let totalRows = 0;

    try {
      // Parse backup data
      const backup = JSON.parse(backupData);

      if (!backup.data || typeof backup.data !== 'object') {
        throw new Error('Invalid backup format: missing data object');
      }

      const tablesData = backup.data as Record<string, any[]>;

      // Validate backup
      if (Object.keys(tablesData).length === 0) {
        warnings.push('Backup contains no tables');
      }

      // Filter tables based on options
      let tablesToImport = Object.keys(tablesData);

      if (options.includeTables && options.includeTables.length > 0) {
        tablesToImport = tablesToImport.filter((t) => options.includeTables!.includes(t));
      }

      if (options.excludeTables && options.excludeTables.length > 0) {
        tablesToImport = tablesToImport.filter((t) => !options.excludeTables!.includes(t));
      }

      // Never allow importing sensitive system tables
      const forbiddenTables = ['admin_users', 'sessions', 'api_keys'];
      tablesToImport = tablesToImport.filter((t) => !forbiddenTables.includes(t));

      if (tablesToImport.length === 0) {
        warnings.push('No tables selected for import after filtering');
      }

      this.env.logger.info('Starting import', {
        totalTables: tablesToImport.length,
        dryRun: options.dryRun || false,
      });

      // Process each table
      for (const tableName of tablesToImport) {
        const rows = tablesData[tableName];

        if (!Array.isArray(rows)) {
          results.push({
            name: tableName,
            rowsImported: 0,
            status: 'failed',
            error: 'Table data is not an array',
          });
          continue;
        }

        if (rows.length === 0) {
          results.push({
            name: tableName,
            rowsImported: 0,
            status: 'skipped',
            error: 'No rows to import',
          });
          continue;
        }

        try {
          // Validate table exists
          const tableCheck = await (this.env.AUDITGUARD_DB as any)
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?1`)
            .bind(tableName)
            .first();

          if (!tableCheck) {
            results.push({
              name: tableName,
              rowsImported: 0,
              status: 'failed',
              error: 'Table does not exist in database',
            });
            continue;
          }

          if (!options.dryRun) {
            // Clear table if overwrite is enabled
            if (options.overwrite) {
              const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;
              await (this.env.AUDITGUARD_DB as any)
                .prepare(`DELETE FROM ${quotedTableName}`)
                .run();

              this.env.logger.info(`Cleared table ${tableName} for overwrite`);
            }

            // Insert rows (batch if possible, otherwise one by one)
            let importedCount = 0;
            for (const row of rows) {
              try {
                const columns = Object.keys(row);
                const values = columns.map((col) => row[col]);

                // Build parameterized query
                const columnsList = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ');
                const placeholders = columns.map((_, i) => `?${i + 1}`).join(', ');
                const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;

                const query = `INSERT INTO ${quotedTableName} (${columnsList}) VALUES (${placeholders})`;

                await (this.env.AUDITGUARD_DB as any)
                  .prepare(query)
                  .bind(...values)
                  .run();

                importedCount++;
              } catch (rowError) {
                // Log error but continue with other rows
                this.env.logger.warn(`Failed to import row in table ${tableName}`, {
                  error: rowError instanceof Error ? rowError.message : String(rowError),
                });
              }
            }

            results.push({
              name: tableName,
              rowsImported: importedCount,
              status: importedCount === rows.length ? 'success' : 'failed',
              error:
                importedCount < rows.length
                  ? `Only ${importedCount}/${rows.length} rows imported`
                  : undefined,
            });

            totalRows += importedCount;
          } else {
            // Dry run: just validate
            results.push({
              name: tableName,
              rowsImported: rows.length,
              status: 'success',
            });
            totalRows += rows.length;
          }

          this.env.logger.info(`Processed table ${tableName}`, {
            rowCount: rows.length,
            dryRun: options.dryRun || false,
          });
        } catch (tableError) {
          results.push({
            name: tableName,
            rowsImported: 0,
            status: 'failed',
            error: tableError instanceof Error ? tableError.message : String(tableError),
          });

          this.env.logger.error(`Failed to import table ${tableName}`, {
            error: tableError instanceof Error ? tableError.message : String(tableError),
          });
        }
      }

      await this.logAdminAction(adminUserId, 'import_backup', 'database', null, {
        tableCount: results.length,
        totalRows,
        dryRun: options.dryRun || false,
        overwrite: options.overwrite || false,
        successCount: results.filter((r) => r.status === 'success').length,
        failedCount: results.filter((r) => r.status === 'failed').length,
      });

      this.env.logger.info('Backup import completed', {
        adminUserId,
        tableCount: results.length,
        totalRows,
        dryRun: options.dryRun || false,
      });

      return {
        tables: results,
        totalRows,
        dryRun: options.dryRun || false,
        warnings,
      };
    } catch (error) {
      this.env.logger.error('Failed to import backup', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Clean up orphaned vectors from embedding service
   * Syncs embedding service with D1 database state (D1 is source of truth)
   */
  async cleanupOrphanedVectors(adminUserId: string): Promise<{
    totalEmbeddings: number;
    validDocuments: number;
    orphanedEmbeddings: number;
    deletedEmbeddings: number;
    deletedChunks: number;
    deletedDocuments: number;
    errors: number;
  }> {
    this.env.logger.info('Cleanup orphaned vectors called', { adminUserId });

    // Verify admin access
    const isAdmin = await this.isAdmin(adminUserId);
    this.env.logger.info('Admin check result', { adminUserId, isAdmin });

    if (!isAdmin) {
      this.env.logger.error('Access denied for cleanup', { adminUserId });
      throw new Error('Access denied');
    }

    this.env.logger.info('Starting orphaned vector cleanup - using D1 as source of truth', { adminUserId });

    try {
      const db = this.getDb();

      // Step 1: Get ALL valid document IDs from D1 (source of truth)
      const validDocsResult = await db
        .selectFrom('documents')
        .select('id')
        .execute();

      const validDocumentIds = validDocsResult.map((doc) => doc.id);

      this.env.logger.info('Retrieved valid documents from D1', {
        count: validDocumentIds.length,
        sampleIds: validDocumentIds.slice(0, 5),
      });

      // Step 2: Find orphaned chunks in D1 (chunks whose document_id is not in valid documents)
      const orphanedChunks = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT id, document_id, vector_id
        FROM document_chunks
        WHERE document_id NOT IN (SELECT id FROM documents)`
      ).all();

      const orphanedCount = orphanedChunks.results?.length || 0;
      const orphanedVectorIds = (orphanedChunks.results || [])
        .filter((chunk: any) => chunk.vector_id)
        .map((chunk: any) => chunk.vector_id);

      this.env.logger.info('Found orphaned chunks in D1', {
        orphanedChunks: orphanedCount,
        orphanedVectorIds: orphanedVectorIds.length,
      });

      let deletedFromVectorIndex = 0;
      let deletedFromD1 = 0;
      let errors = 0;

      // Step 3: Delete orphaned vectors from Raindrop Vector Index (in batches of 50)
      if (orphanedVectorIds.length > 0) {
        const BATCH_SIZE = 50;
        for (let i = 0; i < orphanedVectorIds.length; i += BATCH_SIZE) {
          const batch = orphanedVectorIds.slice(i, i + BATCH_SIZE);
          try {
            await this.env.DOCUMENT_EMBEDDINGS.deleteByIds(batch);
            deletedFromVectorIndex += batch.length;
            this.env.logger.info('Deleted vector batch from Vector Index', {
              batchNumber: Math.floor(i / BATCH_SIZE) + 1,
              batchSize: batch.length,
            });
          } catch (error) {
            errors++;
            this.env.logger.error('Failed to delete vector batch', {
              error: error instanceof Error ? error.message : String(error),
              batchSize: batch.length,
            });
          }
        }
      }

      // Step 4: Delete orphaned chunks from D1
      if (orphanedCount > 0) {
        const deleteResult = await (this.env.AUDITGUARD_DB as any).prepare(
          `DELETE FROM document_chunks
          WHERE document_id NOT IN (SELECT id FROM documents)`
        ).run();

        deletedFromD1 = deleteResult.meta?.changes || 0;

        this.env.logger.info('Deleted orphaned chunks from D1', {
          deletedChunks: deletedFromD1,
        });
      }

      // Get final stats
      const totalEmbeddings = await (this.env.AUDITGUARD_DB as any).prepare(
        `SELECT COUNT(*) as count FROM document_chunks WHERE embedding_status = 'completed'`
      ).first();

      // Log the action
      await this.logAdminAction(adminUserId, 'cleanup_orphaned_vectors', 'embeddings', null, {
        validDocuments: validDocumentIds.length,
        orphanedEmbeddings: orphanedCount,
        deletedFromVectorIndex: deletedFromVectorIndex,
        deletedFromD1: deletedFromD1,
        errors,
        source: 'raindrop_native',
      });

      this.env.logger.info('Orphaned vector cleanup completed', {
        validDocuments: validDocumentIds.length,
        totalEmbeddings: totalEmbeddings?.count || 0,
        orphanedEmbeddings: orphanedCount,
        deletedFromVectorIndex,
        deletedFromD1,
        errors,
      });

      return {
        totalEmbeddings: Number(totalEmbeddings?.count || 0),
        validDocuments: validDocumentIds.length,
        orphanedEmbeddings: orphanedCount,
        deletedEmbeddings: deletedFromVectorIndex,
        deletedChunks: deletedFromD1,
        deletedDocuments: 0, // We don't delete documents, only chunks
        errors,
      };
    } catch (error) {
      this.env.logger.error('Failed to cleanup orphaned vectors', {
        adminUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to cleanup orphaned vectors');
    }
  }
}
