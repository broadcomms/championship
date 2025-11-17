import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely, sql } from 'kysely';
import { D1Dialect } from '../common/kysely-d1';
import { DB } from '../db/auditguard-db/types';

export default class extends Service<Env> {
  private getDb(): Kysely<DB> {
    return new Kysely<DB>({
      dialect: new D1Dialect({ database: this.env.AUDITGUARD_DB }),
    });
  }
  /**
   * Track performance metrics for API requests
   */
  private async trackPerformance(
    operation: string,
    startTime: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;

      await (this.env.AUDITGUARD_DB as any)
        .prepare(`
          INSERT INTO performance_metrics (operation, start_time, end_time, duration, success, meta_info, error, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `)
        .bind(
          operation,
          startTime,
          endTime,
          duration,
          success ? 1 : 0,
          metadata ? JSON.stringify(metadata) : null,
          error || null,
          Date.now()
        )
        .run();
    } catch (err) {
      // Log error but don't fail the request
      this.env.logger.error('Failed to track performance metrics', {
        operation,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Wrap response with performance tracking
   */
  private async trackAndReturn(
    operation: string,
    startTime: number,
    response: Response,
    metadata?: Record<string, any>
  ): Promise<Response> {
    const success = response.status >= 200 && response.status < 400;
    await this.trackPerformance(
      operation,
      startTime,
      success,
      success ? undefined : `HTTP ${response.status}`,
      metadata
    );
    return response;
  }

  /**
   * SECURITY FIX: Safe JSON parsing with validation
   * Prevents crashes from malformed JSON or missing required fields
   */
  private async safeParseJSON<T = any>(
    request: Request,
    requiredFields?: string[]
  ): Promise<{ success: true; data: T } | { success: false; error: string; status: number }> {
    try {
      const body = await request.json() as Record<string, unknown>;

      // Validate required fields if specified
      if (requiredFields && requiredFields.length > 0) {
        const missingFields = requiredFields.filter(field => !(field in body));

        if (missingFields.length > 0) {
          return {
            success: false,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            status: 400,
          };
        }

        // Validate field types are not null/undefined
        const nullFields = requiredFields.filter(field => body[field] === null || body[field] === undefined);
        if (nullFields.length > 0) {
          return {
            success: false,
            error: `Required fields cannot be null: ${nullFields.join(', ')}`,
            status: 400,
          };
        }
      }

      return { success: true, data: body as T };

    } catch (error) {
      this.env.logger.error('Failed to parse JSON request body', {
        error: error instanceof Error ? error.message : String(error),
        path: new URL(request.url).pathname,
      });

      return {
        success: false,
        error: 'Invalid JSON in request body',
        status: 400,
      };
    }
  }

  /**
   * SECURITY FIX: Check if user has admin privileges
   * Used to protect debug and admin-only endpoints
   */
  private async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const db = this.getDb();
      const adminUser = await db
        .selectFrom('admin_users')
        .select(['user_id'])
        .where('user_id', '=', userId)
        .executeTakeFirst();
      
      return !!adminUser;
    } catch (error) {
      this.env.logger.error('Failed to check admin status', { userId, error });
      return false;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const operation = `${request.method} ${path}`;

    // PHASE 4.2.1: Handle WebSocket upgrade requests for real-time notifications
    if (path.startsWith('/api/realtime/') && request.headers.get('Upgrade') === 'websocket') {
      const pathMatch = path.match(/^\/api\/realtime\/([^/]+)$/);
      if (!pathMatch) {
        return new Response('Invalid realtime path', { status: 400 });
      }

      const workspaceId = pathMatch[1];

      // Validate session
      const user = await this.validateSession(request);
      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Verify workspace access
      const db = this.getDb();
      const membership = await db
        .selectFrom('workspace_members')
        .select('role')
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', user.userId)
        .executeTakeFirst();

      if (!membership) {
        return new Response('Forbidden', { status: 403 });
      }

      // Forward to realtime service (with Durable Object)
      // Construct URL for realtime service
      const realtimeUrl = new URL(request.url);
      realtimeUrl.pathname = `/ws/${workspaceId}/realtime`;

      return this.env.REALTIME_SERVICE.fetch(
        new Request(realtimeUrl.toString(), {
          headers: request.headers,
        })
      );
    }

    // CORS helper function
    const getCorsHeaders = (origin: string | null) => {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      };

      // Allow requests from localhost for development and production URL
      const allowedOrigins = ['http://localhost:3000', 'https://auditguardx.com'];
      if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
      }

      return headers;
    };

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    try {
      const origin = request.headers.get('Origin');
      const corsHeaders = getCorsHeaders(origin);

      // Health check
      if (path === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'AuditGuardX API' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // SECURITY FIX: Protect debug/test endpoints with admin authentication
      if (path.startsWith('/api/debug/') || path.startsWith('/api/test-')) {
        // Validate session
        const user = await this.validateSession(request);
        if (!user) {
          return new Response(JSON.stringify({
            error: 'Authentication required',
            details: 'You must be logged in to access debug endpoints'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Check admin privileges
        const isAdmin = await this.isUserAdmin(user.userId);
        if (!isAdmin) {
          return new Response(JSON.stringify({
            error: 'Admin privileges required',
            details: 'Only platform administrators can access debug endpoints'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Debug: List documents
      if (path === '/api/debug/documents' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const workspaceId = url.searchParams.get('workspaceId') || 'wks_1762398900940_1hm208';

          const db = this.getDb();
          const documents = await db
            .selectFrom('documents')
            .selectAll()
            .where('workspace_id', '=', workspaceId)
            .orderBy('uploaded_at', 'desc')
            .limit(10)
            .execute();

          return new Response(JSON.stringify({
            success: true,
            workspaceId,
            count: documents.length,
            documents: documents.map((doc) => ({
              id: doc.id,
              filename: doc.filename,
              title: doc.title,
              description: doc.description,
              processing_status: doc.processing_status,
              uploaded_at: doc.uploaded_at,
              extracted_text_length: (doc as any).extracted_text?.length || 0,
              has_extracted_text: !!(doc as any).extracted_text,
            }))
          }, null, 2), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Manual Enrichment Test - No auth for debugging
      if (path === '/api/test-enrichment' && request.method === 'POST') {
        try {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{ documentId: string; workspaceId: string }>(
            request,
            ['documentId', 'workspaceId']
          );
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          this.env.logger.info('Manual enrichment test started', {
            documentId: body.documentId,
            workspaceId: body.workspaceId,
          });

          // Call processDocument directly
          const result = await this.env.DOCUMENT_SERVICE.processDocument(
            body.documentId,
            body.workspaceId,
            'usr_test'  // Dummy user ID for testing
          );

          return new Response(JSON.stringify({
            success: true,
            result,
            message: 'Enrichment completed!'
          }, null, 2), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (error) {
          this.env.logger.error('Manual enrichment failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });

          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // AI Test Endpoint - No auth required for debugging
      if (path === '/api/test-ai' && request.method === 'POST') {
        try {
          this.env.logger.info('🧪 Testing AI endpoint', {
            timestamp: new Date().toISOString()
          });

          const testPrompt = `You are a helpful assistant. Respond with a JSON object containing:
{
  "status": "working",
  "message": "AI is responding correctly",
  "timestamp": "${new Date().toISOString()}"
}`;

          this.env.logger.info('Calling AI with test prompt');
          
          const aiResponse = await this.env.AI.run('deepseek-r1-distill-qwen-32b', {
            messages: [
              { role: 'user', content: testPrompt }
            ],
            response_format: { type: 'json_object' }
          });

          this.env.logger.info('✅ AI responded successfully', {
            response: aiResponse
          });

          return new Response(JSON.stringify({
            success: true,
            aiResponse,
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });

        } catch (error) {
          this.env.logger.error('❌ AI test failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });

          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // ====== EMAIL CONFIG DEBUG ENDPOINT (PUBLIC) ======
      if (path === '/api/test/email-config' && request.method === 'GET') {
        return new Response(JSON.stringify({
          gateway_env: {
            hasResendKey: !!this.env.RESEND_API_KEY,
            resendKeyPrefix: this.env.RESEND_API_KEY?.substring(0, 10) + '...',
            emailFrom: this.env.EMAIL_FROM
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== EMAIL TEST ENDPOINT (PUBLIC) ======
      if (path === '/api/test/email' && request.method === 'POST') {
        try {
          const body = await request.json() as { email: string };

          if (!body.email) {
            return new Response(JSON.stringify({ error: 'Email address required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          // Call email service directly - send test email
          const result = await this.env.EMAIL_SERVICE.sendEmail({
            to: body.email,
            subject: 'AuditGuardX - Test Email',
            html: `
              <h1>Test Email</h1>
              <p>This is a test email from AuditGuardX to verify the Resend API integration.</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            `,
            text: 'Test email from AuditGuardX - Resend API integration is working!'
          });

          return new Response(JSON.stringify({
            success: result.success,
            emailId: result.id,
            error: result.error,
            message: result.success ? 'Test email sent successfully! Check your inbox.' : 'Failed to send email',
            debug: {
              gatewayHasKey: !!this.env.RESEND_API_KEY,
              gatewayKeyPrefix: this.env.RESEND_API_KEY?.substring(0, 10) + '...'
            }
          }), {
            status: result.success ? 200 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Failed to send test email',
            details: error instanceof Error ? error.message : String(error)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // ====== AUTH ENDPOINTS ======
      if (path === '/api/auth/register' && request.method === 'POST') {
        // CRITICAL FIX: Safe JSON parsing with field validation
        const result = await this.safeParseJSON<{ email: string; password: string; name: string }>(
          request,
          ['email', 'password', 'name']
        );
        if (!result.success) {
          return new Response(JSON.stringify({ error: (result as any).error }), {
            status: (result as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = result.data;

        // Register the user
        await this.env.AUTH_SERVICE.register(body);

        // Immediately log them in to create a session
        const loginResult = await this.env.AUTH_SERVICE.login({
          email: body.email,
          password: body.password,
        });

        // Return user data with session cookie
        const response = new Response(JSON.stringify(loginResult), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
        response.headers.set('Set-Cookie', `session=${loginResult.sessionId}; Path=/; HttpOnly; Max-Age=604800`);
        return response;
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ email: string; password: string }>(
          request,
          ['email', 'password']
        );
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.AUTH_SERVICE.login(body);

        const response = new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
        response.headers.set('Set-Cookie', `session=${result.sessionId}; Path=/; HttpOnly; Max-Age=604800`);
        return response;
      }

      if (path === '/api/auth/logout' && request.method === 'POST') {
        const sessionId = this.getSessionId(request);
        if (sessionId) {
          await this.env.AUTH_SERVICE.logout(sessionId);
        }

        const response = new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
        response.headers.set('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0');
        return response;
      }

      if (path === '/api/auth/me' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const userData = await this.env.AUTH_SERVICE.getUserById(user.userId);
        if (!userData) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify(userData), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== SSO ENDPOINTS ======
      // Initiate SSO login flow
      if (path === '/api/auth/sso/authorize' && request.method === 'GET') {
        const url = new URL(request.url);
        const organizationId = url.searchParams.get('organizationId');
        const provider = url.searchParams.get('provider') as 'google' | 'okta' | 'azure' | 'saml' | 'generic-saml' | null;

        if (!organizationId) {
          return new Response(JSON.stringify({ error: 'organizationId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        try {
          const result = await this.env.SSO_SERVICE.getAuthorizationUrl({
            organizationId,
            provider: provider || undefined,
          });

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (error) {
          this.env.logger.error('SSO authorization URL generation failed', {
            organizationId,
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'SSO authorization failed' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

      // Handle SSO callback
      if (path === '/api/auth/sso/callback' && request.method === 'POST') {
        const parseResult = await this.safeParseJSON<{ code: string }>(request, ['code']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        try {
          // Handle SSO callback and get user info
          const ssoResult = await this.env.SSO_SERVICE.handleSSOCallback({
            code: body.code,
          });

          // Create session for the authenticated user
          const sessionResult = await this.env.AUTH_SERVICE.createSession(ssoResult.userId);

          const response = new Response(
            JSON.stringify({
              user: {
                userId: ssoResult.userId,
                email: ssoResult.email,
                organizationId: ssoResult.organizationId,
                firstName: ssoResult.firstName,
                lastName: ssoResult.lastName,
                isNewUser: ssoResult.isNewUser,
              },
              sessionId: sessionResult.sessionId,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );

          // Set session cookie
          response.headers.set('Set-Cookie', `session=${sessionResult.sessionId}; Path=/; HttpOnly; Max-Age=604800`);
          return response;
        } catch (error) {
          this.env.logger.error('SSO callback failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'SSO authentication failed' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

      // ====== ORGANIZATION ENDPOINTS ======
      // Get user's organizations
      if (path === '/api/organizations' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ORGANIZATION_SERVICE.getUserOrganizations(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/organizations/:id (get single organization)
      const orgMatch = path.match(/^\/api\/organizations\/([^\/]+)$/);
      if (orgMatch && orgMatch[1] && request.method === 'GET') {
        const organizationId = orgMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.ORGANIZATION_SERVICE.getOrganizationSettings(
          organizationId,
          user.userId
        );
        return new Response(JSON.stringify({ data: result }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/organizations/:id/workspaces (get workspaces for organization)
      const orgWorkspacesMatch = path.match(/^\/api\/organizations\/([^\/]+)\/workspaces$/);
      if (orgWorkspacesMatch && orgWorkspacesMatch[1] && request.method === 'GET') {
        const organizationId = orgWorkspacesMatch[1];
        const user = await this.validateSession(request);

        // Get all workspaces for this organization
        const db = this.getDb();
        const workspaces = await db
          .selectFrom('workspaces')
          .select([
            'workspaces.id',
            'workspaces.name',
            'workspaces.description',
            'workspaces.created_at',
            'workspaces.updated_at'
          ])
          .where('workspaces.organization_id', '=', organizationId)
          .orderBy('workspaces.created_at', 'desc')
          .execute();

        // Get member count and document count for each workspace
        const workspacesWithCounts = await Promise.all(
          workspaces.map(async (workspace) => {
            const memberCount = await db
              .selectFrom('workspace_members')
              .select(db.fn.count('id').as('count'))
              .where('workspace_id', '=', workspace.id)
              .executeTakeFirst();

            const documentCount = await db
              .selectFrom('documents')
              .select(db.fn.count('id').as('count'))
              .where('workspace_id', '=', workspace.id)
              .executeTakeFirst();

            return {
              ...workspace,
              member_count: Number(memberCount?.count || 0),
              document_count: Number(documentCount?.count || 0),
            };
          })
        );

        return new Response(JSON.stringify({ data: workspacesWithCounts }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/organizations/:id/stats (get organization statistics)
      const orgStatsMatch = path.match(/^\/api\/organizations\/([^\/]+)\/stats$/);
      if (orgStatsMatch && orgStatsMatch[1] && request.method === 'GET') {
        const organizationId = orgStatsMatch[1];
        const user = await this.validateSession(request);

        const db = this.getDb();

        // Get counts
        const workspaceCount = await db
          .selectFrom('workspaces')
          .select(db.fn.count('id').as('count'))
          .where('organization_id', '=', organizationId)
          .executeTakeFirst();

        const memberCount = await db
          .selectFrom('organization_members')
          .select(db.fn.count('id').as('count'))
          .where('organization_id', '=', organizationId)
          .executeTakeFirst();

        const documentCount = await db
          .selectFrom('documents')
          .innerJoin('workspaces', 'workspaces.id', 'documents.workspace_id')
          .select(db.fn.count('documents.id').as('count'))
          .where('workspaces.organization_id', '=', organizationId)
          .executeTakeFirst();

        const complianceCheckCount = await db
          .selectFrom('compliance_checks')
          .innerJoin('workspaces', 'workspaces.id', 'compliance_checks.workspace_id')
          .select(db.fn.count('compliance_checks.id').as('count'))
          .where('workspaces.organization_id', '=', organizationId)
          .executeTakeFirst();

        // Get subscription info (simplified - get subscription first, then join with plan)
        const subscriptionRow = await db
          .selectFrom('subscriptions')
          .select(['plan_id', 'status'])
          .where('organization_id', '=', organizationId)
          .where('status', 'in', ['active', 'trialing'])
          .executeTakeFirst();

        let subscriptionPlan: {
          name: string;
          limits: any;
        } | null = null;

        if (subscriptionRow) {
          const plan = await db
            .selectFrom('subscription_plans')
            .select(['name', 'limits'])
            .where('id', '=', subscriptionRow.plan_id)
            .executeTakeFirst();
          if (plan) {
            subscriptionPlan = {
              name: plan.name,
              limits: typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
            };
          }
        }

        // Get current month usage
        const now = Date.now();
        const startOfMonth = new Date(new Date().setDate(1)).setHours(0, 0, 0, 0);

        // Get org's workspace IDs first
        const orgWorkspaceIds = await db
          .selectFrom('workspaces')
          .select('id')
          .where('organization_id', '=', organizationId)
          .execute();

        const workspaceIdsList = orgWorkspaceIds.map(w => w.id);

        // Count uploads and checks this month using D1 prepared statements
        let uploadsCount = 0;
        let checksCount = 0;

        if (workspaceIdsList.length > 0) {
          // Use raw D1 queries to avoid Kysely typing issues with created_at
          const uploadsResult = await (this.env.AUDITGUARD_DB as any)
            .prepare(`
              SELECT COUNT(*) as count
              FROM documents
              WHERE workspace_id IN (${workspaceIdsList.map(() => '?').join(',')})
              AND created_at >= ?
            `)
            .bind(...workspaceIdsList, startOfMonth)
            .first();
          uploadsCount = uploadsResult?.count || 0;

          const checksResult = await (this.env.AUDITGUARD_DB as any)
            .prepare(`
              SELECT COUNT(*) as count
              FROM compliance_checks
              WHERE workspace_id IN (${workspaceIdsList.map(() => '?').join(',')})
              AND created_at >= ?
            `)
            .bind(...workspaceIdsList, startOfMonth)
            .first();
          checksCount = checksResult?.count || 0;
        }

        // Extract limits from subscription plan
        const limits = subscriptionPlan?.limits || {};
        const uploadsLimit = limits.max_uploads_per_month || 10;
        const checksLimit = limits.max_compliance_checks_per_month || 5;

        return new Response(JSON.stringify({
          data: {
            total_workspaces: Number(workspaceCount?.count || 0),
            total_members: Number(memberCount?.count || 0),
            total_documents: Number(documentCount?.count || 0),
            total_compliance_checks: Number(complianceCheckCount?.count || 0),
            subscription_tier: subscriptionPlan?.name || 'Free',
            uploads_used: Number(uploadsCount),
            uploads_limit: uploadsLimit,
            checks_used: Number(checksCount),
            checks_limit: checksLimit,
          }
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/organizations/:id/settings
      const orgSettingsMatch = path.match(/^\/api\/organizations\/([^\/]+)\/settings$/);
      if (orgSettingsMatch && orgSettingsMatch[1]) {
        const organizationId = orgSettingsMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.ORGANIZATION_SERVICE.getOrganizationSettings(
            organizationId,
            user.userId
          );
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'PATCH') {
          const parseResult = await this.safeParseJSON<{
            name?: string;
            slug?: string;
            billing_email?: string;
          }>(request);

          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.ORGANIZATION_SERVICE.updateOrganizationSettings(
            organizationId,
            user.userId,
            body
          );
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/organizations/:id/members
      const orgMembersMatch = path.match(/^\/api\/organizations\/([^\/]+)\/members$/);
      if (orgMembersMatch && orgMembersMatch[1]) {
        const organizationId = orgMembersMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.ORGANIZATION_SERVICE.getOrganizationMembers(
            organizationId,
            user.userId
          );
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'POST') {
          const parseResult = await this.safeParseJSON<{
            email: string;
            role: 'admin' | 'member' | 'billing';
          }>(request, ['email', 'role']);

          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.ORGANIZATION_SERVICE.addOrganizationMember(
            organizationId,
            user.userId,
            body
          );
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/organizations/:id/members/:memberId
      const orgMemberMatch = path.match(/^\/api\/organizations\/([^\/]+)\/members\/([^\/]+)$/);
      if (orgMemberMatch && orgMemberMatch[1] && orgMemberMatch[2]) {
        const organizationId = orgMemberMatch[1];
        const memberId = orgMemberMatch[2];
        const user = await this.validateSession(request);

        if (request.method === 'PATCH') {
          const parseResult = await this.safeParseJSON<{
            role: 'admin' | 'member' | 'billing';
          }>(request, ['role']);

          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.ORGANIZATION_SERVICE.updateOrganizationMemberRole(
            organizationId,
            user.userId,
            memberId,
            body.role
          );
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          const result = await this.env.ORGANIZATION_SERVICE.removeOrganizationMember(
            organizationId,
            user.userId,
            memberId
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/organizations/:id/usage
      const orgUsageMatch = path.match(/^\/api\/organizations\/([^\/]+)\/usage$/);
      if (orgUsageMatch && orgUsageMatch[1] && request.method === 'GET') {
        const organizationId = orgUsageMatch[1];
        const user = await this.validateSession(request);

        // Get query parameter for period
        const period = url.searchParams.get('period') as 'current' | 'last30days' | 'all-time' || 'current';

        const result = await this.env.ORGANIZATION_SERVICE.getOrganizationUsage(
          organizationId,
          user.userId,
          period
        );
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/organizations/:id/usage/forecast
      const orgForecastMatch = path.match(/^\/api\/organizations\/([^\/]+)\/usage\/forecast$/);
      if (orgForecastMatch && orgForecastMatch[1] && request.method === 'GET') {
        const organizationId = orgForecastMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.ORGANIZATION_SERVICE.getOrganizationUsageForecast(
          organizationId,
          user.userId
        );
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/organizations/:id/sso/config - SSO configuration endpoints
      const ssoConfigMatch = path.match(/^\/api\/organizations\/([^\/]+)\/sso\/config$/);
      if (ssoConfigMatch && ssoConfigMatch[1]) {
        const organizationId = ssoConfigMatch[1];
        const user = await this.validateSession(request);

        // Get SSO configuration
        if (request.method === 'GET') {
          try {
            const result = await this.env.SSO_SERVICE.getSSOConnection(organizationId);
            if (!result) {
              return new Response(JSON.stringify({ error: 'SSO not configured' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          } catch (error) {
            this.env.logger.error('Failed to get SSO config', {
              organizationId,
              error: error instanceof Error ? error.message : String(error),
            });
            return new Response(
              JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get SSO configuration' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }
        }

        // Update SSO configuration (enable/disable)
        if (request.method === 'POST' || request.method === 'PATCH') {
          const parseResult = await this.safeParseJSON<{
            enabled?: boolean;
            provider?: 'google' | 'okta' | 'azure' | 'saml' | 'generic-saml';
            workosOrganizationId?: string;
            workosConnectionId?: string;
          }>(request);

          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          try {
            // If creating a new connection
            if (body.provider && body.workosOrganizationId) {
              const result = await this.env.SSO_SERVICE.createSSOConnection({
                organizationId,
                provider: body.provider,
                workosOrganizationId: body.workosOrganizationId,
                workosConnectionId: body.workosConnectionId,
              });
              return new Response(JSON.stringify(result), {
                status: 201,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }

            // If updating enabled status
            if (body.enabled !== undefined) {
              const result = await this.env.SSO_SERVICE.updateSSOConnection({
                organizationId,
                enabled: body.enabled,
              });
              return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }

            return new Response(
              JSON.stringify({ error: 'Invalid request. Provide either provider & workosOrganizationId or enabled flag' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          } catch (error) {
            this.env.logger.error('Failed to update SSO config', {
              organizationId,
              error: error instanceof Error ? error.message : String(error),
            });
            return new Response(
              JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update SSO configuration' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }
        }

        // Delete SSO configuration
        if (request.method === 'DELETE') {
          try {
            const result = await this.env.SSO_SERVICE.deleteSSOConnection(organizationId);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          } catch (error) {
            this.env.logger.error('Failed to delete SSO config', {
              organizationId,
              error: error instanceof Error ? error.message : String(error),
            });
            return new Response(
              JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to delete SSO configuration' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }
        }
      }

      // ====== PUBLIC PRICING ENDPOINTS (No Auth Required) ======
      // Get all active subscription plans
      if (path === '/api/plans' && request.method === 'GET') {
        const result = await this.env.BILLING_SERVICE.getPlans();
        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            ...corsHeaders
          },
        });
      }

      // Get feature comparison matrix
      if (path === '/api/plans/compare' && request.method === 'GET') {
        const result = await this.env.BILLING_SERVICE.getPlansComparison();
        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            ...corsHeaders
          },
        });
      }

      // ====== WORKSPACE ENDPOINTS ======
      if (path === '/api/workspaces' && request.method === 'POST') {
        const user = await this.validateSession(request);
        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ name: string; description?: string }>(
          request,
          ['name'] // Only name is required
        );
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.WORKSPACE_SERVICE.createWorkspace({
          ...body,
          userId: user.userId,
        });
        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (path === '/api/workspaces' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.WORKSPACE_SERVICE.getWorkspaces(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (path === '/api/workspaces/limits' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.WORKSPACE_SERVICE.getWorkspaceLimits(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id
      const workspaceMatch = path.match(/^\/api\/workspaces\/([^\/]+)$/);
      if (workspaceMatch && workspaceMatch[1]) {
        const workspaceId = workspaceMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.WORKSPACE_SERVICE.getWorkspace(workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'PUT') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{ name?: string; description?: string }>(
            request
            // No required fields - all optional
          );
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.WORKSPACE_SERVICE.updateWorkspace(workspaceId, user.userId, body);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          await this.env.WORKSPACE_SERVICE.deleteWorkspace(workspaceId, user.userId);
          return new Response(null, { status: 204 });
        }
      }

      // Match /api/workspaces/:id/members
      const membersMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/members$/);
      if (membersMatch && membersMatch[1]) {
        const workspaceId = membersMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.WORKSPACE_SERVICE.getMembers(workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'POST') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{ email: string; role: 'admin' | 'member' | 'viewer' }>(
            request,
            ['email', 'role']
          );
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.WORKSPACE_SERVICE.addMember(workspaceId, user.userId, body);
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/workspaces/:id/members/:userId
      const memberMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/members\/([^\/]+)$/);
      if (memberMatch && memberMatch[1] && memberMatch[2]) {
        const workspaceId = memberMatch[1];
        const targetUserId = memberMatch[2];
        const user = await this.validateSession(request);

        if (request.method === 'PUT') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{ role: 'admin' | 'member' | 'viewer' }>(
            request,
            ['role']
          );
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.WORKSPACE_SERVICE.updateMemberRole(
            workspaceId,
            user.userId,
            targetUserId,
            body.role
          );
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          await this.env.WORKSPACE_SERVICE.removeMember(workspaceId, user.userId, targetUserId);
          return new Response(null, { status: 204 });
        }
      }

      // ====== WORKSPACE INVITATION ENDPOINTS ======
      // POST /api/workspaces/:id/invitations - Create invitation
      // GET /api/workspaces/:id/invitations - List invitations
      // DELETE /api/workspaces/:id/invitations/:invitationId - Cancel invitation
      const invitationsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/invitations$/);
      if (invitationsMatch && invitationsMatch[1]) {
        const workspaceId = invitationsMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'POST') {
          // Create invitation
          const parseResult = await this.safeParseJSON<{ email: string; role: 'admin' | 'member' | 'viewer' }>(
            request,
            ['email', 'role']
          );
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          const result = await this.env.WORKSPACE_SERVICE.createInvitation({
            workspaceId,
            email: body.email,
            role: body.role,
            invitedBy: user.userId,
          });

          // Get workspace and inviter information for email
          const workspace = await this.env.WORKSPACE_SERVICE.getWorkspace(workspaceId, user.userId);
          const inviterInfo = await this.env.AUTH_SERVICE.getUserById(user.userId);

          // Send invitation email (async via queue)
          try {
            await this.env.EMAIL_NOTIFICATIONS_QUEUE.send({
              type: 'workspace_invitation',
              to: body.email,
              data: {
                inviterName: inviterInfo.email.split('@')[0],
                workspaceName: workspace.name,
                role: body.role,
                invitationLink: `https://auditguard.com/accept-invitation?token=${result.invitationToken}`,
              },
            });
          } catch (emailError) {
            this.env.logger.error('Failed to queue invitation email', {
              workspaceId,
              email: body.email,
              error: emailError instanceof Error ? emailError.message : String(emailError),
            });
            // Don't fail the invitation creation if email fails
          }

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'GET') {
          // List invitations
          const result = await this.env.WORKSPACE_SERVICE.getWorkspaceInvitations(workspaceId);
          return new Response(JSON.stringify({ invitations: result }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // DELETE /api/workspaces/:id/invitations/:invitationId - Cancel invitation
      const invitationCancelMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/invitations\/([^\/]+)$/);
      if (invitationCancelMatch && invitationCancelMatch[1] && invitationCancelMatch[2]) {
        const workspaceId = invitationCancelMatch[1];
        const invitationId = invitationCancelMatch[2];
        const user = await this.validateSession(request);

        if (request.method === 'DELETE') {
          const result = await this.env.WORKSPACE_SERVICE.cancelInvitation({
            invitationId,
            cancelledBy: user.userId,
          });
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // POST /api/accept-invitation - Accept invitation (public endpoint)
      if (path === '/api/accept-invitation' && request.method === 'POST') {
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{ invitationToken: string }>(
          request,
          ['invitationToken']
        );
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.WORKSPACE_SERVICE.acceptInvitation({
          invitationToken: body.invitationToken,
          userId: user.userId,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== DOCUMENT ENDPOINTS ======
      // Match /api/workspaces/:id/documents
      const documentsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents$/);
      if (documentsMatch && documentsMatch[1]) {
        const workspaceId = documentsMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.DOCUMENT_SERVICE.listDocuments(workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'POST') {
          // Phase 7: Check document limit before upload
          const limitCheck = await this.env.BILLING_SERVICE.checkLimit(workspaceId, 'documents');
          if (!limitCheck.allowed) {
            return new Response(
              JSON.stringify({
                error: 'Document limit exceeded',
                message: `You've reached your plan limit of ${limitCheck.limit} documents. Please upgrade to continue uploading.`,
                current: limitCheck.current,
                limit: limitCheck.limit,
                percentage: limitCheck.percentage,
                upgrade_required: true,
              }),
              {
                status: 402, // Payment Required
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }

          // Handle multipart/form-data file upload
          const contentType = request.headers.get('Content-Type') || '';

          if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File;
            const filename = (formData.get('filename') as string) || file?.name || 'unnamed';
            const category = formData.get('category') as 'policy' | 'procedure' | 'evidence' | 'other' | undefined;
            const frameworkId = formData.get('frameworkId') ? parseInt(formData.get('frameworkId') as string, 10) : undefined;

            if (!file) {
              return new Response(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }

            const fileBuffer = await file.arrayBuffer();

            const result = await this.env.DOCUMENT_SERVICE.uploadDocument({
              workspaceId,
              userId: user.userId,
              file: fileBuffer,
              filename,
              contentType: file.type || 'application/octet-stream',
              category,
              frameworkId,  // Phase 4: Framework support
            });

            return new Response(JSON.stringify(result), {
              status: 201,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          } else {
            // Handle JSON upload (base64 encoded file)
            // CRITICAL FIX: Safe JSON parsing with field validation
            const parseResult = await this.safeParseJSON<{
              file: string;
              filename: string;
              contentType: string;
              category?: 'policy' | 'procedure' | 'evidence' | 'other';
              frameworkId?: number;
            }>(request, ['file', 'filename', 'contentType']);
            if (!parseResult.success) {
              return new Response(JSON.stringify({ error: (parseResult as any).error }), {
                status: (parseResult as any).status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }
            const body = parseResult.data;

            // Decode base64 file
            const fileBuffer = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));

            const result = await this.env.DOCUMENT_SERVICE.uploadDocument({
              workspaceId,
              userId: user.userId,
              file: fileBuffer.buffer,
              filename: body.filename,
              contentType: body.contentType,
              category: body.category,
              frameworkId: body.frameworkId,  // Phase 4: Framework support
            });

            return new Response(JSON.stringify(result), {
              status: 201,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
        }
      }

      // Match /api/workspaces/:id/documents/:documentId/download
      const downloadMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/download$/);
      if (downloadMatch && downloadMatch[1] && downloadMatch[2] && request.method === 'GET') {
        const workspaceId = downloadMatch[1];
        const documentId = downloadMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.DOCUMENT_SERVICE.downloadDocument(documentId, workspaceId, user.userId);

        return new Response(result.file, {
          headers: {
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
          },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/processing-steps
      const processingStepsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/processing-steps$/);
      if (processingStepsMatch && processingStepsMatch[1] && processingStepsMatch[2] && request.method === 'GET') {
        const workspaceId = processingStepsMatch[1];
        const documentId = processingStepsMatch[2];
        const user = await this.validateSession(request);

        // Get processing steps from document service
        const steps = await this.env.DOCUMENT_SERVICE.getProcessingSteps(documentId);

        return new Response(
          JSON.stringify({ steps }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Match /api/workspaces/:id/documents/:documentId/process
      const processMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/process$/);
      if (processMatch && processMatch[1] && processMatch[2] && request.method === 'POST') {
        const workspaceId = processMatch[1];
        const documentId = processMatch[2];
        const user = await this.validateSession(request);

        // Get document to retrieve vultr_key for reprocessing
        const document = await this.env.DOCUMENT_SERVICE.getDocument(documentId, workspaceId, user.userId);

        if (!document.vultrKey) {
          return new Response(
            JSON.stringify({
              error: 'Document does not have a valid Vultr storage key. Cannot reprocess.',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        this.env.logger.info('Starting FULL document reprocessing', {
          documentId,
          workspaceId,
          userId: user.userId,
          vultrKey: document.vultrKey,
          note: 'Will run complete pipeline: extract → chunk → embed → index → enrich',
        });

        // Update status to pending for reprocessing
        // CRITICAL FIX: Also reset fully_completed so progress indicator shows
        try {
          await (this.env.AUDITGUARD_DB as any).prepare(
            `UPDATE documents
             SET processing_status = 'pending',
                 fully_completed = 0,
                 updated_at = ?
             WHERE id = ?`
          ).bind(Date.now(), documentId).run();

          this.env.logger.info('✅ Document status reset for reprocessing', {
            documentId,
            status: 'pending',
            fullyCompleted: false,
          });
        } catch (statusError) {
          this.env.logger.warn('Failed to update status to pending', {
            documentId,
            error: statusError instanceof Error ? statusError.message : String(statusError),
          });
        }

        // Send to processing queue for FULL pipeline reprocessing
        try {
          await this.env.DOCUMENT_PROCESSING_QUEUE.send({
            documentId,
            workspaceId,
            userId: user.userId,
            vultrKey: document.vultrKey,
            action: 'reprocess',  // NEW: Triggers full reprocessing flow
            frameworkId: document.complianceFrameworkId,
          });

          this.env.logger.info('✅ Document queued for full reprocessing', {
            documentId,
            workspaceId,
            action: 'reprocess',
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Document queued for full reprocessing (extract → chunk → embed → index → enrich)',
              documentId,
              processing: true,
            }),
            {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        } catch (error) {
          this.env.logger.error('Failed to queue document for reprocessing', {
            documentId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to queue document for reprocessing',
              details: error instanceof Error ? error.message : String(error),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

      // Match /api/workspaces/:id/documents/:documentId/re-extract-text
      // This endpoint re-extracts text from Vultr storage for old documents
      const reExtractTextMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/re-extract-text$/);
      if (reExtractTextMatch && reExtractTextMatch[1] && reExtractTextMatch[2] && request.method === 'POST') {
        const workspaceId = reExtractTextMatch[1];
        const documentId = reExtractTextMatch[2];
        const user = await this.validateSession(request);

        this.env.logger.info('🔄 Starting text re-extraction for old document', {
          documentId,
          workspaceId,
          userId: user.userId,
        });

        try {
          const result = await this.env.DOCUMENT_SERVICE.reExtractText(
            documentId,
            workspaceId,
            user.userId
          );

          this.env.logger.info('✅ Text re-extraction successful', {
            documentId,
            textLength: result.extractedText.length,
            wordCount: result.wordCount,
            pageCount: result.pageCount,
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Text re-extracted successfully',
              documentId,
              textLength: result.extractedText.length,
              wordCount: result.wordCount,
              pageCount: result.pageCount,
            }),
            {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        } catch (error) {
          this.env.logger.error('❌ Text re-extraction failed', {
            documentId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to re-extract text',
              details: error instanceof Error ? error.message : String(error),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

      // NEW: Save extracted text from frontend after embedding service call
      // POST /api/workspaces/:id/documents/:documentId/extracted-text
      const extractedTextMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/extracted-text$/);
      if (extractedTextMatch && extractedTextMatch[1] && extractedTextMatch[2] && request.method === 'POST') {
        const workspaceId = extractedTextMatch[1];
        const documentId = extractedTextMatch[2];
        const user = await this.validateSession(request);

        try {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{
            extractedText: string;
            wordCount: number;
            pageCount?: number;
          }>(request, ['extractedText', 'wordCount']);
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;

          this.env.logger.info('💾 Saving extracted text to D1 (from frontend)', {
            documentId,
            workspaceId,
            textLength: body.extractedText?.length || 0,
            wordCount: body.wordCount,
            pageCount: body.pageCount,
          });

          // Save extracted_text to D1 using updateDocumentProcessing
          await this.env.DOCUMENT_SERVICE.updateDocumentProcessing(documentId, {
            textExtracted: true,
            chunkCount: 0,  // Chunks are in PostgreSQL, not D1
            processingStatus: 'processing',  // Still processing, enrichment will run later
            processedAt: Date.now(),
            extractedText: body.extractedText,
            wordCount: body.wordCount,
            pageCount: body.pageCount,
          });

          this.env.logger.info('✅ Extracted text saved to D1 successfully', {
            documentId,
            textLength: body.extractedText?.length || 0,
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Extracted text saved successfully',
              documentId,
            }),
            {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        } catch (error) {
          this.env.logger.error('Failed to save extracted text', {
            documentId,
            error: error instanceof Error ? error.message : String(error),
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to save extracted text',
              details: error instanceof Error ? error.message : String(error),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

      // Phase 5: Match /api/workspaces/:id/documents/:documentId/chunks
      const chunksMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/chunks$/);
      if (chunksMatch && chunksMatch[1] && chunksMatch[2] && request.method === 'GET') {
        const workspaceId = chunksMatch[1];
        const documentId = chunksMatch[2];
        const user = await this.validateSession(request);

        const chunks = await this.env.DOCUMENT_SERVICE.getDocumentChunks(
          workspaceId,
          user.userId,
          documentId
        );

        return new Response(JSON.stringify(chunks), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/embedding-stats (diagnostic endpoint)
      const embeddingStatsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/embedding-stats$/);
      if (embeddingStatsMatch && embeddingStatsMatch[1] && embeddingStatsMatch[2] && request.method === 'GET') {
        const workspaceId = embeddingStatsMatch[1];
        const documentId = embeddingStatsMatch[2];
        const user = await this.validateSession(request);

        const stats = await this.env.DOCUMENT_SERVICE.getEmbeddingStats(
          documentId,
          workspaceId,
          user.userId
        );

        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/vector-status (ACTUAL vector index status)
      const vectorStatusMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/vector-status$/);
      if (vectorStatusMatch && vectorStatusMatch[1] && vectorStatusMatch[2] && request.method === 'GET') {
        const workspaceId = vectorStatusMatch[1];
        const documentId = vectorStatusMatch[2];
        const user = await this.validateSession(request);

        const status = await this.env.DOCUMENT_SERVICE.getActualVectorIndexStatus(
          documentId,
          workspaceId,
          user.userId
        );

        return new Response(JSON.stringify(status), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/search (semantic search)
      const documentSearchMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/search$/);
      if (documentSearchMatch && documentSearchMatch[1] && request.method === 'POST') {
        const workspaceId = documentSearchMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          query: string;
          page?: number;
          pageSize?: number;
        }>(request, ['query']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.searchDocuments(
          workspaceId,
          user.userId,
          body.query,
          body.page,
          body.pageSize
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/chat
      const documentChatMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/chat$/);
      if (documentChatMatch && documentChatMatch[1] && documentChatMatch[2] && request.method === 'POST') {
        const workspaceId = documentChatMatch[1];
        const documentId = documentChatMatch[2];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ question: string }>(request, ['question']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!body.question) {
          return new Response(JSON.stringify({ error: 'Question is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.chatWithDocument(
          documentId,
          workspaceId,
          user.userId,
          body.question
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/chunks
      const documentChunksMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/chunks$/);
      if (documentChunksMatch && documentChunksMatch[1] && request.method === 'POST') {
        const workspaceId = documentChunksMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          query: string;
          documentId?: string;
        }>(request, ['query']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!body.query) {
          return new Response(JSON.stringify({ error: 'Query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.getRelevantChunks(
          workspaceId,
          user.userId,
          body.query,
          body.documentId
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/search/paginate
      const searchPaginateMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/search\/paginate$/);
      if (searchPaginateMatch && searchPaginateMatch[1] && request.method === 'POST') {
        const workspaceId = searchPaginateMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          requestId: string;
          page: number;
          pageSize?: number;
        }>(request, ['requestId', 'page']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!body.requestId || body.page === undefined) {
          return new Response(JSON.stringify({ error: 'RequestId and page are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.getPaginatedSearchResults(
          workspaceId,
          user.userId,
          body.requestId,
          body.page,
          body.pageSize
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/search/summarize
      const searchSummarizeMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/search\/summarize$/);
      if (searchSummarizeMatch && searchSummarizeMatch[1] && request.method === 'POST') {
        const workspaceId = searchSummarizeMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          requestId: string;
          page: number;
          pageSize?: number;
        }>(request, ['requestId', 'page']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.summarizeSearchPage(
          workspaceId,
          user.userId,
          body.requestId,
          body.page,
          body.pageSize
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/multimodal-search
      const multimodalSearchMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/multimodal-search$/);
      if (multimodalSearchMatch && multimodalSearchMatch[1] && request.method === 'POST') {
        const workspaceId = multimodalSearchMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          text?: string;
          images?: string;
          audio?: string;
          contentTypes?: string[];
        }>(request);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!body.text && !body.images && !body.audio) {
          return new Response(JSON.stringify({ error: 'At least one search criterion is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.multiModalSearch(
          workspaceId,
          user.userId,
          body
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/vector-search (Phase 3: Vector embeddings search)
      const vectorSearchMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/vector-search$/);
      if (vectorSearchMatch && vectorSearchMatch[1] && request.method === 'POST') {
        const workspaceId = vectorSearchMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          query: string;
          frameworkId?: number;
          topK?: number;
          minScore?: number;
          includeChunks?: boolean;
          page?: number;
          pageSize?: number;
        }>(request, ['query']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.DOCUMENT_SERVICE.vectorSearch(
          workspaceId,
          user.userId,
          {
            query: body.query,
            workspaceId,
            frameworkId: body.frameworkId,
            topK: body.topK,
            minScore: body.minScore,
            includeChunks: body.includeChunks,
            page: body.page,
            pageSize: body.pageSize,
          }
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/pii
      const piiDetectionMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/pii$/);
      if (piiDetectionMatch && piiDetectionMatch[1] && piiDetectionMatch[2] && request.method === 'POST') {
        const workspaceId = piiDetectionMatch[1];
        const documentId = piiDetectionMatch[2];
        const user = await this.validateSession(request);

        // @ts-expect-error - Raindrop Framework v0.9.1 stub type generation bug
        const result = await this.env.DOCUMENT_SERVICE.detectPII(
          documentId,
          workspaceId,
          user.userId
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/content
      const contentMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/content$/);
      if (contentMatch && contentMatch[1] && contentMatch[2] && request.method === 'GET') {
        const workspaceId = contentMatch[1];
        const documentId = contentMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.DOCUMENT_SERVICE.getDocumentContent(
          documentId,
          workspaceId,
          user.userId
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId
      const documentMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)$/);
      if (documentMatch && documentMatch[1] && documentMatch[2]) {
        const workspaceId = documentMatch[1];
        const documentId = documentMatch[2];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.DOCUMENT_SERVICE.getDocument(documentId, workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'PUT') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{
            filename?: string;
            category?: 'policy' | 'procedure' | 'evidence' | 'other';
          }>(request);
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;
          const result = await this.env.DOCUMENT_SERVICE.updateMetadata(documentId, workspaceId, user.userId, body);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          await this.env.DOCUMENT_SERVICE.deleteDocument(documentId, workspaceId, user.userId);
          return new Response(null, { status: 204 });
        }
      }

      // ====== COMPLIANCE ENDPOINTS ======
      // Match /api/workspaces/:id/documents/:documentId/compliance
      const complianceMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/compliance$/);
      if (complianceMatch && complianceMatch[1] && complianceMatch[2] && request.method === 'POST') {
        const workspaceId = complianceMatch[1];
        const documentId = complianceMatch[2];
        const user = await this.validateSession(request);

        // Phase 7: Check compliance checks limit before running check
        const limitCheck = await this.env.BILLING_SERVICE.checkLimit(workspaceId, 'compliance_checks');
        if (!limitCheck.allowed) {
          return new Response(
            JSON.stringify({
              error: 'Compliance check limit exceeded',
              message: `You've reached your plan limit of ${limitCheck.limit} compliance checks. Please upgrade to continue.`,
              current: limitCheck.current,
              limit: limitCheck.limit,
              percentage: limitCheck.percentage,
              upgrade_required: true,
            }),
            {
              status: 402, // Payment Required
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          framework: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS' | 'ISO_27001' | 'NIST_CSF' | 'CCPA' | 'FERPA' | 'GLBA' | 'FISMA' | 'PIPEDA' | 'COPPA' | 'SOX';
        }>(request, ['framework']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.COMPLIANCE_SERVICE.runComplianceCheck({
          documentId,
          workspaceId,
          userId: user.userId,
          framework: body.framework,
        });

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/compliance (list all checks)
      const complianceListMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/compliance$/);
      if (complianceListMatch && complianceListMatch[1] && request.method === 'GET') {
        const workspaceId = complianceListMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.COMPLIANCE_SERVICE.listComplianceChecks(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 1.4: Match /api/workspaces/:id/compliance/batch (start batch check)
      const batchCreateMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/compliance\/batch$/);
      if (batchCreateMatch && batchCreateMatch[1] && request.method === 'POST') {
        const workspaceId = batchCreateMatch[1];
        const user = await this.validateSession(request);

        // Phase 7: Check compliance checks limit before batch check
        const limitCheck = await this.env.BILLING_SERVICE.checkLimit(workspaceId, 'compliance_checks');
        if (!limitCheck.allowed) {
          return new Response(
            JSON.stringify({
              error: 'Compliance check limit exceeded',
              message: `You've reached your plan limit of ${limitCheck.limit} compliance checks. Please upgrade to continue.`,
              current: limitCheck.current,
              limit: limitCheck.limit,
              percentage: limitCheck.percentage,
              upgrade_required: true,
            }),
            {
              status: 402, // Payment Required
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          documentIds: string[];
          framework: string;
        }>(request, ['documentIds', 'framework']);

        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const { documentIds, framework } = parseResult.data;

        // Validate documentIds is an array
        if (!Array.isArray(documentIds) || documentIds.length === 0) {
          return new Response(JSON.stringify({ error: 'documentIds must be a non-empty array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.COMPLIANCE_SERVICE.runBatchComplianceCheck({
          documentIds,
          workspaceId,
          userId: user.userId,
          framework: framework as any,
        });

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 1.4: Match /api/workspaces/:id/compliance/batch/:batchId (get batch status)
      const batchStatusMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/compliance\/batch\/([^\/]+)$/);
      if (batchStatusMatch && batchStatusMatch[1] && batchStatusMatch[2] && request.method === 'GET') {
        const workspaceId = batchStatusMatch[1];
        const batchId = batchStatusMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.COMPLIANCE_SERVICE.getBatchStatus(batchId, workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/compliance/:checkId
      const checkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/compliance\/([^\/]+)$/);
      if (checkMatch && checkMatch[1] && checkMatch[2] && request.method === 'GET') {
        const workspaceId = checkMatch[1];
        const checkId = checkMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.COMPLIANCE_SERVICE.getComplianceCheck(checkId, workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/compliance/:checkId/issues
      const issuesMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/compliance\/([^\/]+)\/issues$/);
      if (issuesMatch && issuesMatch[1] && issuesMatch[2] && request.method === 'GET') {
        const workspaceId = issuesMatch[1];
        const checkId = issuesMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.COMPLIANCE_SERVICE.getComplianceIssues(checkId, workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== COMPLIANCE FRAMEWORK ENDPOINTS ======
      // Match /api/workspaces/:id/frameworks (list all frameworks)
      const frameworksListMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/frameworks$/);
      if (frameworksListMatch && frameworksListMatch[1] && request.method === 'GET') {
        const workspaceId = frameworksListMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.DOCUMENT_SERVICE.listFrameworks(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/compliance-frameworks/:frameworkId (get single framework)
      const singleFrameworkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/compliance-frameworks\/([^\/]+)$/);
      if (singleFrameworkMatch && singleFrameworkMatch[1] && singleFrameworkMatch[2] && request.method === 'GET') {
        const workspaceId = singleFrameworkMatch[1];
        const frameworkId = parseInt(singleFrameworkMatch[2], 10);
        const user = await this.validateSession(request);

        const frameworks = await this.env.DOCUMENT_SERVICE.listFrameworks(workspaceId, user.userId);
        const framework = frameworks.find(f => f.id === frameworkId);

        if (!framework) {
          return new Response(JSON.stringify({ error: 'Framework not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({ framework }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/framework (assign framework to document)
      const assignFrameworkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/framework$/);
      if (assignFrameworkMatch && assignFrameworkMatch[1] && assignFrameworkMatch[2] && request.method === 'PUT') {
        const workspaceId = assignFrameworkMatch[1];
        const documentId = assignFrameworkMatch[2];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ frameworkId: number }>(request, ['frameworkId']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        await this.env.DOCUMENT_SERVICE.assignFrameworkToDocument(
          documentId,
          workspaceId,
          user.userId,
          body.frameworkId
        );

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/frameworks/:frameworkId/chunks (get framework chunks)
      const frameworkChunksMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/frameworks\/([^\/]+)\/chunks$/);
      if (frameworkChunksMatch && frameworkChunksMatch[1] && frameworkChunksMatch[2] && request.method === 'GET') {
        const workspaceId = frameworkChunksMatch[1];
        const frameworkId = parseInt(frameworkChunksMatch[2], 10);
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const minRelevance = parseFloat(url.searchParams.get('minRelevance') || '0.6');

        const result = await this.env.DOCUMENT_SERVICE.getFrameworkChunks(
          workspaceId,
          user.userId,
          frameworkId,
          minRelevance
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/chunks/:chunkId/tags (tag a chunk)
      const tagChunkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/chunks\/([^\/]+)\/tags$/);
      if (tagChunkMatch && tagChunkMatch[1] && tagChunkMatch[2] && request.method === 'POST') {
        const workspaceId = tagChunkMatch[1];
        const chunkId = parseInt(tagChunkMatch[2], 10);
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          frameworkId: number;
          relevanceScore?: number;
        }>(request, ['frameworkId']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        await this.env.DOCUMENT_SERVICE.tagChunk(
          workspaceId,
          user.userId,
          chunkId,
          body.frameworkId,
          body.relevanceScore
        );

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/chunks/:chunkId/tags/:frameworkId (untag a chunk)
      const untagChunkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/chunks\/([^\/]+)\/tags\/([^\/]+)$/);
      if (untagChunkMatch && untagChunkMatch[1] && untagChunkMatch[2] && untagChunkMatch[3] && request.method === 'DELETE') {
        const workspaceId = untagChunkMatch[1];
        const chunkId = parseInt(untagChunkMatch[2], 10);
        const frameworkId = parseInt(untagChunkMatch[3], 10);
        const user = await this.validateSession(request);

        await this.env.DOCUMENT_SERVICE.untagChunk(
          workspaceId,
          user.userId,
          chunkId,
          frameworkId
        );

        return new Response(null, { status: 204 });
      }

      // ====== PHASE 2.2: DOCUMENT COMPLIANCE ENDPOINTS ======
      // Match /api/workspaces/:id/documents/:documentId/compliance/checks (get all compliance checks for document)
      const docComplianceChecksMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/compliance\/checks$/);
      if (docComplianceChecksMatch && docComplianceChecksMatch[1] && docComplianceChecksMatch[2] && request.method === 'GET') {
        const workspaceId = docComplianceChecksMatch[1];
        const documentId = docComplianceChecksMatch[2];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const framework = url.searchParams.get('framework') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const result = await this.env.COMPLIANCE_SERVICE.getDocumentComplianceChecks(
          documentId,
          workspaceId,
          user.userId,
          { framework, limit, offset }
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/compliance/summary (get cached compliance summary)
      const docComplianceSummaryMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/compliance\/summary$/);
      if (docComplianceSummaryMatch && docComplianceSummaryMatch[1] && docComplianceSummaryMatch[2] && request.method === 'GET') {
        const workspaceId = docComplianceSummaryMatch[1];
        const documentId = docComplianceSummaryMatch[2];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const framework = url.searchParams.get('framework') || undefined;

        const result = await this.env.COMPLIANCE_SERVICE.getDocumentComplianceSummary(
          documentId,
          workspaceId,
          user.userId,
          framework
        );

        return new Response(JSON.stringify(result || { error: 'No compliance summary available' }), {
          status: result ? 200 : 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/documents/:documentId/compliance/analyze (trigger compliance analysis)
      const docComplianceAnalyzeMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/compliance\/analyze$/);
      if (docComplianceAnalyzeMatch && docComplianceAnalyzeMatch[1] && docComplianceAnalyzeMatch[2] && request.method === 'POST') {
        const workspaceId = docComplianceAnalyzeMatch[1];
        const documentId = docComplianceAnalyzeMatch[2];
        const user = await this.validateSession(request);

        // Parse request body for framework selection (optional)
        let framework: 'GDPR' | 'HIPAA' | 'SOC2' | 'ISO_27001' | 'PCI_DSS' = 'GDPR';
        try {
          const body = await request.json() as { framework?: string };
          if (body.framework) {
            framework = body.framework as 'GDPR' | 'HIPAA' | 'SOC2' | 'ISO_27001' | 'PCI_DSS';
          }
        } catch {
          // No body or invalid JSON - use default framework
        }

        const result = await this.env.COMPLIANCE_SERVICE.runComplianceCheck({
          documentId,
          workspaceId,
          userId: user.userId,
          framework,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 2.2: ISSUE MANAGEMENT ENDPOINTS ======
      // Match /api/workspaces/:id/documents/:documentId/issues (get issues with filters)
      const docIssuesMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/issues$/);
      if (docIssuesMatch && docIssuesMatch[1] && docIssuesMatch[2] && request.method === 'GET') {
        const workspaceId = docIssuesMatch[1];
        const documentId = docIssuesMatch[2];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const checkId = url.searchParams.get('checkId') || undefined;
        const severity = url.searchParams.get('severity')?.split(',') as any[] || undefined;
        const status = url.searchParams.get('status')?.split(',') as any[] || undefined;
        const search = url.searchParams.get('search') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const result = await this.env.ISSUE_MANAGEMENT_SERVICE.getDocumentIssues({
          workspaceId,
          documentId,
          userId: user.userId,
          checkId,
          severity,
          status,
          search,
          limit,
          offset,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/:issueId (get issue details)
      const issueDetailsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)$/);
      if (issueDetailsMatch && issueDetailsMatch[1] && issueDetailsMatch[2] && request.method === 'GET') {
        const workspaceId = issueDetailsMatch[1];
        const issueId = issueDetailsMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.ISSUE_MANAGEMENT_SERVICE.getIssueDetails({
          workspaceId,
          issueId,
          userId: user.userId,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/:issueId/status (update issue status)
      const issueStatusUpdateMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)\/status$/);
      if (issueStatusUpdateMatch && issueStatusUpdateMatch[1] && issueStatusUpdateMatch[2] && request.method === 'PATCH') {
        const workspaceId = issueStatusUpdateMatch[1];
        const issueId = issueStatusUpdateMatch[2];
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{
          status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
          notes?: string;
        }>(request, ['status']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        await this.env.ISSUE_MANAGEMENT_SERVICE.updateIssueStatus({
          issueId,
          workspaceId,
          userId: user.userId,
          newStatus: body.status,
          notes: body.notes,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/:issueId/resolve (mark issue as resolved)
      const issueResolveMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)\/resolve$/);
      if (issueResolveMatch && issueResolveMatch[1] && issueResolveMatch[2] && request.method === 'POST') {
        const workspaceId = issueResolveMatch[1];
        const issueId = issueResolveMatch[2];
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{
          resolutionNotes?: string;
        }>(request);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        await this.env.ISSUE_MANAGEMENT_SERVICE.resolveIssue({
          issueId,
          workspaceId,
          userId: user.userId,
          resolutionNotes: body.resolutionNotes,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/bulk (bulk update issues)
      const issuesBulkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/bulk$/);
      if (issuesBulkMatch && issuesBulkMatch[1] && request.method === 'POST') {
        const workspaceId = issuesBulkMatch[1];
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{
          issueIds: string[];
          action: 'resolve' | 'dismiss' | 'reopen';
          notes?: string;
        }>(request, ['issueIds', 'action']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!Array.isArray(body.issueIds) || body.issueIds.length === 0) {
          return new Response(JSON.stringify({ error: 'issueIds must be a non-empty array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.ISSUE_MANAGEMENT_SERVICE.bulkUpdateIssues({
          issueIds: body.issueIds,
          workspaceId,
          userId: user.userId,
          action: body.action,
          notes: body.notes,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 2.2: ISSUE ASSIGNMENT ENDPOINTS ======
      // Match /api/workspaces/:id/issues/:issueId/assign (assign issue)
      const issueAssignMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)\/assign$/);
      if (issueAssignMatch && issueAssignMatch[1] && issueAssignMatch[2] && request.method === 'POST') {
        const workspaceId = issueAssignMatch[1];
        const issueId = issueAssignMatch[2];
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{
          assignedTo: string;
          notes?: string;
        }>(request, ['assignedTo']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        await this.env.ISSUE_ASSIGNMENT_SERVICE.assignIssue({
          issueId,
          workspaceId,
          assignedTo: body.assignedTo,
          assignedBy: user.userId,
          notes: body.notes,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/:issueId/unassign (unassign issue)
      const issueUnassignMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)\/unassign$/);
      if (issueUnassignMatch && issueUnassignMatch[1] && issueUnassignMatch[2] && request.method === 'POST') {
        const workspaceId = issueUnassignMatch[1];
        const issueId = issueUnassignMatch[2];
        const user = await this.validateSession(request);

        await this.env.ISSUE_ASSIGNMENT_SERVICE.unassignIssue({
          issueId,
          workspaceId,
          userId: user.userId,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/assigned/:userId (get assigned issues)
      const assignedIssuesMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/assigned\/([^\/]+)$/);
      if (assignedIssuesMatch && assignedIssuesMatch[1] && assignedIssuesMatch[2] && request.method === 'GET') {
        const workspaceId = assignedIssuesMatch[1];
        const assignedTo = assignedIssuesMatch[2];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const status = url.searchParams.get('status')?.split(',') as any[] || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const result = await this.env.ISSUE_ASSIGNMENT_SERVICE.getAssignedIssues({
          workspaceId,
          userId: user.userId,
          assignedTo,
          status,
          limit,
          offset,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/:issueId/assignment-history (get assignment history)
      const assignmentHistoryMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)\/assignment-history$/);
      if (assignmentHistoryMatch && assignmentHistoryMatch[1] && assignmentHistoryMatch[2] && request.method === 'GET') {
        const workspaceId = assignmentHistoryMatch[1];
        const issueId = assignmentHistoryMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.ISSUE_ASSIGNMENT_SERVICE.getIssueAssignmentHistory({
          issueId,
          workspaceId,
          userId: user.userId,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/bulk-assign (bulk assign issues)
      const issuesBulkAssignMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/bulk-assign$/);
      if (issuesBulkAssignMatch && issuesBulkAssignMatch[1] && request.method === 'POST') {
        const workspaceId = issuesBulkAssignMatch[1];
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{
          issueIds: string[];
          assignedTo: string;
          notes?: string;
        }>(request, ['issueIds', 'assignedTo']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!Array.isArray(body.issueIds) || body.issueIds.length === 0) {
          return new Response(JSON.stringify({ error: 'issueIds must be a non-empty array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.ISSUE_ASSIGNMENT_SERVICE.bulkAssignIssues({
          issueIds: body.issueIds,
          workspaceId,
          assignedTo: body.assignedTo,
          assignedBy: user.userId,
          notes: body.notes,
        });

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== ANALYTICS ENDPOINTS ======
      // Match /api/workspaces/:id/analytics/calculate
      const calculateMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/analytics\/calculate$/);
      if (calculateMatch && calculateMatch[1] && request.method === 'POST') {
        const workspaceId = calculateMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.ANALYTICS_SERVICE.calculateWorkspaceScore(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/dashboard
      const dashboardMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/dashboard$/);
      if (dashboardMatch && dashboardMatch[1] && request.method === 'GET') {
        const workspaceId = dashboardMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.ANALYTICS_SERVICE.getWorkspaceDashboard(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/analytics/trends
      const trendsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/analytics\/trends$/);
      if (trendsMatch && trendsMatch[1] && request.method === 'GET') {
        const workspaceId = trendsMatch[1];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '30', 10);

        const result = await this.env.ANALYTICS_SERVICE.getTrendAnalysis(workspaceId, user.userId, days);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 1.2.1: Match /api/workspaces/:id/analytics/maturity
      const maturityMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/analytics\/maturity$/);
      if (maturityMatch && maturityMatch[1] && request.method === 'GET') {
        const workspaceId = maturityMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.ANALYTICS_SERVICE.calculateMaturityLevel(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 1.2.2: Match /api/workspaces/:id/analytics/framework/:framework
      const frameworkMaturityMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/analytics\/framework\/([^\/]+)$/);
      if (frameworkMaturityMatch && frameworkMaturityMatch[1] && frameworkMaturityMatch[2] && request.method === 'GET') {
        const workspaceId = frameworkMaturityMatch[1];
        const framework = frameworkMaturityMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.ANALYTICS_SERVICE.getFrameworkMaturity(workspaceId, user.userId, framework);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 3.1.2: Match /api/workspaces/:id/analytics/benchmarks
      const benchmarksMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/analytics\/benchmarks$/);
      if (benchmarksMatch && benchmarksMatch[1] && request.method === 'GET') {
        const workspaceId = benchmarksMatch[1];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const industry = url.searchParams.get('industry') as 'healthcare' | 'finance' | 'technology' | 'retail' | 'government' | 'general' | null;
        const size = url.searchParams.get('size') as 'small' | 'medium' | 'large' | 'enterprise' | null;

        const result = await this.env.ANALYTICS_SERVICE.getBenchmarkComparisons(
          workspaceId,
          user.userId,
          {
            industry: industry || undefined,
            size: size || undefined,
          }
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 1.3.2: Match /api/workspaces/:id/reports/executive
      const executiveReportMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/reports\/executive$/);
      if (executiveReportMatch && executiveReportMatch[1] && request.method === 'POST') {
        const workspaceId = executiveReportMatch[1];
        const user = await this.validateSession(request);

        // Parse optional parameters
        const parseResult = await this.safeParseJSON<{
          startDate?: number;
          endDate?: number;
          frameworks?: string[];
        }>(request, []);

        const options = parseResult.success ? parseResult.data : {};

        const result = await this.env.REPORTING_SERVICE.generateExecutiveSummary(workspaceId, user.userId, options);

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 1.3.4: Match /api/workspaces/:id/reports/export/:format
      const exportMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/reports\/export\/([^\/]+)$/);
      if (exportMatch && exportMatch[1] && exportMatch[2] && request.method === 'POST') {
        const workspaceId = exportMatch[1];
        const format = exportMatch[2] as 'json' | 'csv';
        const user = await this.validateSession(request);

        if (format !== 'json' && format !== 'csv') {
          return new Response(JSON.stringify({ error: 'Invalid export format. Use json or csv' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Parse optional parameters
        const parseResult = await this.safeParseJSON<{
          includeIssues?: boolean;
          includeChecks?: boolean;
          frameworks?: string[];
          startDate?: number;
          endDate?: number;
        }>(request, []);

        const options = parseResult.success ? parseResult.data : {};

        const result = await this.env.REPORTING_SERVICE.exportComplianceData(workspaceId, user.userId, format, options);

        return new Response(result.data, {
          headers: {
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            ...corsHeaders,
          },
        });
      }

      // POST /api/workspaces/:id/reports - Save a generated report
      const saveReportMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/reports$/);
      if (saveReportMatch && saveReportMatch[1] && request.method === 'POST') {
        const workspaceId = saveReportMatch[1];
        const user = await this.validateSession(request);

        const parseResult = await this.safeParseJSON<{
          name: string;
          frameworks: string[];
          reportPeriod: { startDate: number; endDate: number };
          summary: any;
        }>(request, ['name', 'frameworks', 'reportPeriod', 'summary']);

        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.REPORTING_SERVICE.saveReport(workspaceId, user.userId, parseResult.data);

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/workspaces/:id/reports - Get all saved reports for a workspace
      if (saveReportMatch && saveReportMatch[1] && request.method === 'GET') {
        const workspaceId = saveReportMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.REPORTING_SERVICE.getReports(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/workspaces/:id/reports/:reportId - Get a single saved report
      const getSingleReportMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/reports\/([^\/]+)$/);
      if (
        getSingleReportMatch &&
        getSingleReportMatch[1] &&
        getSingleReportMatch[2] &&
        request.method === 'GET' &&
        !getSingleReportMatch[2].startsWith('executive') &&
        !getSingleReportMatch[2].startsWith('export')
      ) {
        const workspaceId = getSingleReportMatch[1];
        const reportId = getSingleReportMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.REPORTING_SERVICE.getReport(workspaceId, user.userId, reportId);

        if (!result) {
          return new Response(JSON.stringify({ error: 'Report not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // DELETE /api/workspaces/:id/reports/:reportId - Delete a saved report
      const deleteSingleReportMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/reports\/([^\/]+)$/);
      if (
        deleteSingleReportMatch &&
        deleteSingleReportMatch[1] &&
        deleteSingleReportMatch[2] &&
        request.method === 'DELETE' &&
        !deleteSingleReportMatch[2].startsWith('executive') &&
        !deleteSingleReportMatch[2].startsWith('export')
      ) {
        const workspaceId = deleteSingleReportMatch[1];
        const reportId = deleteSingleReportMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.REPORTING_SERVICE.deleteReport(workspaceId, user.userId, reportId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ==========================================================================
      // AI ASSISTANT ROUTES
      // ==========================================================================

      // POST /api/workspaces/:id/assistant/chat - Send message to AI assistant
      const assistantChatMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/chat$/);
      if (assistantChatMatch && assistantChatMatch[1] && request.method === 'POST') {
        const startTime = Date.now();
        const operation = 'assistant.chat';

        try {
          const workspaceId = assistantChatMatch[1];
          const user = await this.validateSession(request);

          const parseResult = await this.safeParseJSON<{
            message: string;
            sessionId?: string;
            context?: {
              currentPage?: string;
              documentId?: string;
            };
          }>(request, ['message']);

          if (!parseResult.success) {
            return this.trackAndReturn(
              operation,
              startTime,
              new Response(JSON.stringify({ error: (parseResult as any).error }), {
                status: (parseResult as any).status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              })
            );
          }

          const result = await this.env.ASSISTANT_SERVICE.chat(workspaceId, user.userId, parseResult.data);

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: error instanceof Error && error.message.includes('Access denied') ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // POST /api/workspaces/:id/assistant/stream - Stream AI assistant responses (SSE)
      const assistantStreamMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/stream$/);
      if (assistantStreamMatch && assistantStreamMatch[1] && request.method === 'POST') {
        const startTime = Date.now();
        const operation = 'assistant.stream';

        try {
          const workspaceId = assistantStreamMatch[1];
          const user = await this.validateSession(request);

          const parseResult = await this.safeParseJSON<{
            message: string;
            sessionId?: string;
            context?: {
              currentPage?: string;
              documentId?: string;
            };
          }>(request, ['message']);

          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          // Get ReadableStream from assistant service
          const stream = await this.env.ASSISTANT_SERVICE.streamChat(workspaceId, user.userId, parseResult.data);

          // Track performance (fire and forget - streaming is long-running)
          this.trackPerformance(operation, startTime, true, undefined, {
            workspaceId,
            sessionId: parseResult.data.sessionId || 'new',
          }).catch(err => {
            this.env.logger.error('Failed to track streaming performance', { error: err });
          });

          // Return SSE stream with proper headers
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              ...corsHeaders,
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          this.env.logger.error('Streaming error', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          });

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: error instanceof Error && error.message.includes('Access denied') ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // GET /api/workspaces/:id/assistant/sessions - List conversation sessions
      const assistantSessionsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/sessions$/);
      if (assistantSessionsMatch && assistantSessionsMatch[1] && request.method === 'GET') {
        const startTime = Date.now();
        const operation = 'assistant.listSessions';

        try {
          const workspaceId = assistantSessionsMatch[1];
          const user = await this.validateSession(request);

          const result = await this.env.ASSISTANT_SERVICE.listSessions(workspaceId, user.userId);

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: error instanceof Error && error.message.includes('Access denied') ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // GET /api/workspaces/:id/assistant/sessions/:sessionId - Get session history
      const assistantSessionHistoryMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/sessions\/([^\/]+)$/);
      if (assistantSessionHistoryMatch && assistantSessionHistoryMatch[1] && assistantSessionHistoryMatch[2] && request.method === 'GET') {
        const startTime = Date.now();
        const operation = 'assistant.getSessionHistory';

        try {
          const workspaceId = assistantSessionHistoryMatch[1];
          const sessionId = assistantSessionHistoryMatch[2];
          const user = await this.validateSession(request);

          const result = await this.env.ASSISTANT_SERVICE.getSessionHistory(sessionId, workspaceId, user.userId);

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: error instanceof Error && error.message.includes('Access denied') ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // DELETE /api/workspaces/:id/assistant/sessions/:sessionId - Delete session
      if (assistantSessionHistoryMatch && assistantSessionHistoryMatch[1] && assistantSessionHistoryMatch[2] && request.method === 'DELETE') {
        const startTime = Date.now();
        const operation = 'assistant.deleteSession';

        try {
          const workspaceId = assistantSessionHistoryMatch[1];
          const sessionId = assistantSessionHistoryMatch[2];
          const user = await this.validateSession(request);

          const result = await this.env.ASSISTANT_SERVICE.deleteSession(sessionId, workspaceId, user.userId);

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: error instanceof Error && error.message.includes('Access denied') ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/assistant/initialize (admin-only)
      if (path === '/api/assistant/initialize' && request.method === 'POST') {
        const startTime = Date.now();
        const operation = 'assistant.initialize';

        try {
          // For now, allow without auth for initial setup
          // In production, add admin role check:
          // const user = await this.validateSession(request);
          // if (user.role !== 'admin') throw new Error('Admin access required');

          const result = await this.env.ASSISTANT_SERVICE.initializeSmartMemory();

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Initialize knowledge base embeddings
      if (path === '/api/assistant/initialize-knowledge-embeddings' && request.method === 'POST') {
        const startTime = Date.now();
        const operation = 'assistant.initialize-knowledge-embeddings';

        try {
          // For now, allow without auth for initial setup
          // In production, add admin role check:
          // const user = await this.validateSession(request);
          // if (user.role !== 'admin') throw new Error('Admin access required');

          const result = await this.env.ASSISTANT_SERVICE.initializeKnowledgeEmbeddings();

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // ==========================================================================
      // END AI ASSISTANT ROUTES
      // ==========================================================================


      // Match /api/workspaces/:id/issues
      const workspaceIssuesMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues$/);
      if (workspaceIssuesMatch && workspaceIssuesMatch[1] && request.method === 'GET') {
        const workspaceId = workspaceIssuesMatch[1];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const status = url.searchParams.get('status') as
          | 'open'
          | 'in_progress'
          | 'resolved'
          | 'dismissed'
          | undefined;

        const result = await this.env.ANALYTICS_SERVICE.getIssuesByStatus(workspaceId, user.userId, status);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/issues/:issueId
      const issueUpdateMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/issues\/([^\/]+)$/);
      if (issueUpdateMatch && issueUpdateMatch[1] && issueUpdateMatch[2] && request.method === 'PUT') {
        const workspaceId = issueUpdateMatch[1];
        const issueId = issueUpdateMatch[2];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
          assignedTo?: string;
        }>(request, ['status']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ANALYTICS_SERVICE.updateIssueStatus(
          issueId,
          workspaceId,
          user.userId,
          body.status,
          body.assignedTo
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== BILLING & SUBSCRIPTION ENDPOINTS ======
      // GET /api/billing/plans
      if (path === '/api/billing/plans' && request.method === 'GET') {
        const result = await this.env.BILLING_SERVICE.getPlans();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/subscription
      const subscriptionMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/subscription$/);
      if (subscriptionMatch && subscriptionMatch[1]) {
        const workspaceId = subscriptionMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.BILLING_SERVICE.getWorkspaceSubscription(workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'POST') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{
            planId: string;
            paymentMethodId?: string;
          }>(request, ['planId']);
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;
          const result = await this.env.BILLING_SERVICE.createSubscription(user.userId, {
            workspaceId,
            planId: body.planId,
            paymentMethodId: body.paymentMethodId,
          });
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'PUT') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{ planId: string }>(request, ['planId']);
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;
          const result = await this.env.BILLING_SERVICE.updateSubscription(user.userId, {
            workspaceId,
            planId: body.planId,
          });
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          // CRITICAL FIX: Safe JSON parsing with field validation
          const parseResult = await this.safeParseJSON<{ cancelAtPeriodEnd?: boolean }>(request);
          if (!parseResult.success) {
            return new Response(JSON.stringify({ error: (parseResult as any).error }), {
              status: (parseResult as any).status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          const body = parseResult.data;
          const result = await this.env.BILLING_SERVICE.cancelSubscription(user.userId, {
            workspaceId,
            cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? true,
          });
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/workspaces/:id/subscription/sync
      const subscriptionSyncMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/subscription\/sync$/);
      if (subscriptionSyncMatch && subscriptionSyncMatch[1]) {
        const workspaceId = subscriptionSyncMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'POST') {
          const result = await this.env.BILLING_SERVICE.syncSubscriptionStatus(workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/workspaces/:id/payment-methods
      const paymentMethodsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/payment-methods$/);
      if (paymentMethodsMatch && paymentMethodsMatch[1]) {
        const workspaceId = paymentMethodsMatch[1];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.BILLING_SERVICE.listPaymentMethods(workspaceId, user.userId);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Match /api/workspaces/:id/payment-methods/:paymentMethodId/set-default
      const setDefaultPaymentMethodMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/payment-methods\/([^\/]+)\/set-default$/);
      if (setDefaultPaymentMethodMatch && setDefaultPaymentMethodMatch[1] && setDefaultPaymentMethodMatch[2] && request.method === 'POST') {
        const workspaceId = setDefaultPaymentMethodMatch[1];
        const paymentMethodId = setDefaultPaymentMethodMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.BILLING_SERVICE.setDefaultPaymentMethod(workspaceId, user.userId, paymentMethodId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/payment-methods/:paymentMethodId
      const removePaymentMethodMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/payment-methods\/([^\/]+)$/);
      if (removePaymentMethodMatch && removePaymentMethodMatch[1] && removePaymentMethodMatch[2] && request.method === 'DELETE') {
        const workspaceId = removePaymentMethodMatch[1];
        const paymentMethodId = removePaymentMethodMatch[2];
        const user = await this.validateSession(request);

        const result = await this.env.BILLING_SERVICE.removePaymentMethod(workspaceId, user.userId, paymentMethodId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/billing-history
      const billingHistoryMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/billing-history$/);
      if (billingHistoryMatch && billingHistoryMatch[1] && request.method === 'GET') {
        const workspaceId = billingHistoryMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.BILLING_SERVICE.getBillingHistory(workspaceId, user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 3: GET /api/workspaces/:id/trial-status - Get trial status for organization
      const trialStatusMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/trial-status$/);
      if (trialStatusMatch && trialStatusMatch[1] && request.method === 'GET') {
        const workspaceId = trialStatusMatch[1];
        const user = await this.validateSession(request);

        // Get workspace to find organization_id
        const workspace = await this.env.WORKSPACE_SERVICE.getWorkspace(workspaceId, user.userId);
        
        if (!workspace || !workspace.organization_id) {
          return new Response(JSON.stringify({ error: 'Workspace not found or not linked to organization' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.TRIAL_EXPIRY_SERVICE.getTrialStatus(workspace.organization_id);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PHASE 4: POST /api/feature-gate/check - Check feature access for workspace
      if (path === '/api/feature-gate/check' && request.method === 'POST') {
        const user = await this.validateSession(request);
        const result = await this.env.FEATURE_GATE_SERVICE.fetch(request.clone());
        return result;
      }

      // PHASE 4: POST /api/feature-gate/features - Get all features for workspace
      if (path === '/api/feature-gate/features' && request.method === 'POST') {
        const user = await this.validateSession(request);
        const body = await request.json();
        const modifiedRequest = new Request(request.url.replace('/api/feature-gate/features', '/plan-features'), {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(body),
        });
        const result = await this.env.FEATURE_GATE_SERVICE.fetch(modifiedRequest);
        return result;
      }

      // ====== USAGE & LIMITS ENDPOINTS ======
      // Match /api/workspaces/:id/usage
      const usageMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/usage$/);
      if (usageMatch && usageMatch[1] && request.method === 'GET') {
        const workspaceId = usageMatch[1];
        const user = await this.validateSession(request);

        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '30', 10);

        const result = await this.env.USAGE_SERVICE.getUsage(workspaceId, user.userId, days);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/limits
      const limitsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/limits$/);
      if (limitsMatch && limitsMatch[1] && request.method === 'GET') {
        const workspaceId = limitsMatch[1];
        const user = await this.validateSession(request);

        // Phase 4.2: Use usage-service for formatted limit data
        const result = await this.env.USAGE_SERVICE.getWorkspaceLimits(workspaceId, user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/stats
      const statsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/stats$/);
      if (statsMatch && statsMatch[1] && request.method === 'GET') {
        const workspaceId = statsMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.USAGE_SERVICE.getWorkspaceStats(workspaceId, user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/workspaces/:id/value-metrics
      // Phase 4.3: Get ROI metrics and time savings for workspace
      const valueMetricsMatch = path.match(/^\/api\/workspaces\/([^/]+)\/value-metrics$/);
      if (valueMetricsMatch && request.method === 'GET') {
        const workspaceId = valueMetricsMatch[1];
        const user = await this.validateSession(request);

        // TODO: Uncomment after raindrop.gen is generated
        const result = await (this.env as any).VALUE_METRICS_SERVICE.fetch(
          new Request(`http://internal/workspaces/${workspaceId}/value-metrics`, {
            headers: request.headers,
          }),
          this.env
        );
        
        const data = await result.json();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== ADMIN ENDPOINTS ======
      // GET /api/admin/stats
      if (path === '/api/admin/stats' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getSystemStats(user.userId);
        return this.trackAndReturn(
          operation,
          startTime,
          new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        );
      }

      // GET /api/admin/users
      if (path === '/api/admin/users' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const result = await this.env.ADMIN_SERVICE.getAllUsers(user.userId, limit, offset);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/settings
      if (path === '/api/admin/settings' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getSystemSettings(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PUT /api/admin/settings/:key
      const adminSettingMatch = path.match(/^\/api\/admin\/settings\/([^\/]+)$/);
      if (adminSettingMatch && adminSettingMatch[1] && request.method === 'PUT') {
        const key = adminSettingMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ value: string }>(request, ['value']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.updateSystemSetting(user.userId, key, body.value);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/audit-log
      if (path === '/api/admin/audit-log' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);

        const result = await this.env.ADMIN_SERVICE.getAuditLog(user.userId, limit);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/trigger-embeddings - Manually trigger embeddings for pending chunks
      if (path === '/api/admin/trigger-embeddings' && request.method === 'POST') {
        this.env.logger.info('Manually triggering embeddings for pending chunks');

        try {
          // Find all pending chunks
          const pendingChunks = await (this.env.AUDITGUARD_DB as any).prepare(`
            SELECT
              dc.id as chunk_id,
              dc.document_id,
              dc.chunk_index,
              dc.content as chunk_text,
              d.workspace_id
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.embedding_status = 'pending'
            ORDER BY dc.created_at DESC
          `).all();

          const chunks = pendingChunks.results || [];

          if (chunks.length === 0) {
            this.env.logger.info('No pending chunks found');
            return new Response(JSON.stringify({
              success: true,
              message: 'No pending chunks found',
              totalPending: 0,
              chunksQueued: 0,
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          this.env.logger.info(`Found ${chunks.length} pending chunks, queuing for embedding generation`);

          // Queue each chunk via document processing queue
          let queuedCount = 0;
          let errors = 0;

          for (const chunk of chunks) {
            try {
              // Update status to processing
              await (this.env.AUDITGUARD_DB as any).prepare(
                `UPDATE document_chunks SET embedding_status = 'processing' WHERE id = ?`
              ).bind(chunk.chunk_id).run();

              // Send to document processing queue which will trigger embedding generation
              await (this.env as any).DOCUMENT_PROCESSING_QUEUE.send({
                type: 'generate_embedding',
                chunkId: chunk.chunk_id,
                documentId: chunk.document_id,
                workspaceId: chunk.workspace_id,
                chunkText: chunk.chunk_text,
                chunkIndex: chunk.chunk_index,
              });

              queuedCount++;
              this.env.logger.info(`Queued chunk ${chunk.chunk_index} from document ${chunk.document_id}`, {
                chunkId: chunk.chunk_id,
              });

            } catch (error) {
              errors++;
              this.env.logger.error(`Failed to queue chunk ${chunk.chunk_id}`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          this.env.logger.info(`Successfully queued ${queuedCount} chunks for embedding generation`, {
            totalPending: chunks.length,
            queuedCount,
            errors,
          });

          return new Response(JSON.stringify({
            success: true,
            message: `Queued ${queuedCount} chunks for embedding generation`,
            totalPending: chunks.length,
            chunksQueued: queuedCount,
            errors: errors > 0 ? errors : undefined,
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });

        } catch (error) {
          this.env.logger.error('Failed to trigger embeddings', {
            error: error instanceof Error ? error.message : String(error),
          });

          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // POST /api/admin/reset-processing-chunks - Reset chunks stuck in 'processing' status
      if (path === '/api/admin/reset-processing-chunks' && request.method === 'POST') {
        this.env.logger.info('Resetting chunks stuck in processing status');

        try {
          // Find chunks stuck in 'processing' status for more than 5 minutes
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

          const processingChunks = await (this.env.AUDITGUARD_DB as any).prepare(`
            SELECT
              dc.id as chunk_id,
              dc.document_id,
              dc.chunk_index,
              dc.created_at
            FROM document_chunks dc
            WHERE dc.embedding_status = 'processing'
              AND dc.created_at < ?
            ORDER BY dc.created_at ASC
          `).bind(fiveMinutesAgo).all();

          const chunks = processingChunks.results || [];

          if (chunks.length === 0) {
            this.env.logger.info('No stuck processing chunks found');
            return new Response(JSON.stringify({
              success: true,
              message: 'No stuck processing chunks found',
              totalReset: 0,
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          this.env.logger.info(`Found ${chunks.length} chunks stuck in processing, resetting to pending`);

          // Reset all stuck chunks to 'pending'
          let resetCount = 0;
          for (const chunk of chunks) {
            try {
              await (this.env.AUDITGUARD_DB as any).prepare(
                `UPDATE document_chunks SET embedding_status = 'pending' WHERE id = ?`
              ).bind(chunk.chunk_id).run();

              resetCount++;
              this.env.logger.info(`Reset chunk ${chunk.chunk_index} from document ${chunk.document_id}`, {
                chunkId: chunk.chunk_id,
              });
            } catch (error) {
              this.env.logger.error(`Failed to reset chunk ${chunk.chunk_id}`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          this.env.logger.info(`Successfully reset ${resetCount} chunks to pending`);

          return new Response(JSON.stringify({
            success: true,
            message: `Reset ${resetCount} chunks from processing to pending`,
            totalReset: resetCount,
            totalFound: chunks.length,
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });

        } catch (error) {
          this.env.logger.error('Failed to reset processing chunks', {
            error: error instanceof Error ? error.message : String(error),
          });

          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // GET /api/admin/test-embedding-service - Test embedding service connectivity
      if (path === '/api/admin/test-embedding-service' && request.method === 'GET') {
        try {
          const serviceUrl = (this.env as any).LOCAL_EMBEDDING_SERVICE_URL || 'NOT SET';
          const apiKey = (this.env as any).EMBEDDING_SERVICE_API_KEY || 'NOT SET';

          // Try to call the embedding service
          const testResponse = await fetch(`${serviceUrl}/embed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({
              texts: ['test connection'],
              batch_size: 1,
              normalize: true,
            }),
          });

          const responseText = await testResponse.text();
          let responseData: any;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = { raw: responseText };
          }

          return new Response(JSON.stringify({
            success: testResponse.ok,
            serviceUrl,
            apiKeyConfigured: apiKey !== 'NOT SET',
            status: testResponse.status,
            statusText: testResponse.statusText,
            headers: Object.fromEntries(testResponse.headers.entries()),
            response: responseData,
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            serviceUrl: (this.env as any).LOCAL_EMBEDDING_SERVICE_URL || 'NOT SET',
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // GET /api/admin/chunk-status-debug - Debug chunk statuses
      if (path === '/api/admin/chunk-status-debug' && request.method === 'GET') {
        this.env.logger.info('Debug: Getting all chunk statuses');

        try {
          // Get chunk status counts
          const statusCounts = await (this.env.AUDITGUARD_DB as any).prepare(`
            SELECT
              embedding_status,
              COUNT(*) as count
            FROM document_chunks
            GROUP BY embedding_status
          `).all();

          // Get recent chunks with details
          const recentChunks = await (this.env.AUDITGUARD_DB as any).prepare(`
            SELECT
              dc.id,
              dc.document_id,
              dc.chunk_index,
              dc.embedding_status,
              dc.vector_id,
              d.filename,
              d.vector_indexing_status
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            ORDER BY dc.created_at DESC
            LIMIT 20
          `).all();

          return new Response(JSON.stringify({
            statusCounts: statusCounts.results || [],
            recentChunks: recentChunks.results || [],
          }, null, 2), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });

        } catch (error) {
          this.env.logger.error('Failed to get chunk status debug info', {
            error: error instanceof Error ? error.message : String(error),
          });

          return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // POST /api/admin/test-embedding - Test embedding service directly
      if (path === '/api/admin/test-embedding' && request.method === 'POST') {
        this.env.logger.info('Testing embedding service directly');

        try {
          // Import embedding service
          const { EmbeddingService } = await import('../embedding-service');
          const embeddingService = new EmbeddingService(this.env);

          this.env.logger.info('EmbeddingService instance created');

          // Test with a simple chunk
          const testChunk = {
            text: 'This is a test document chunk for testing the embedding service.',
            index: 0,
            metadata: {
              chunkIndex: 0,
              startChar: 0,
              endChar: 64,
              hasHeader: false,
              sectionTitle: undefined,
              tokenCount: 12,
            },
          };

          this.env.logger.info('Calling generateAndStoreEmbeddings');

          const result = await embeddingService.generateAndStoreEmbeddings(
            'test-doc-123',
            'test-workspace',
            [testChunk],
            ['chunk_test-doc-123_0']  // Fake chunk ID (now string)
          );

          this.env.logger.info('Test embedding completed', { result });

          return new Response(JSON.stringify({
            success: true,
            result,
            message: 'Embedding service test passed!',
          }, null, 2), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });

        } catch (error) {
          this.env.logger.error('Test embedding failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });

          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // POST /api/admin/analytics/query
      if (path === '/api/admin/analytics/query' && request.method === 'POST') {
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ query: string }>(request, ['query']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.queryAnalytics(user.userId, body.query);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/create - Create new admin user (super_admin only)
      if (path === '/api/admin/create' && request.method === 'POST') {
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          userId: string;
          role: 'super_admin' | 'support' | 'billing_admin';
          permissions: string[];
        }>(request, ['userId', 'role', 'permissions']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.createAdmin(user.userId, {
          userId: body.userId,
          role: body.role,
          permissions: body.permissions || ['*'],
          createdBy: user.userId,
        });
        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 1: DATABASE VISUALIZATION ENDPOINTS ======

      // GET /api/admin/database/schema - View all database tables
      if (path === '/api/admin/database/schema' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getDatabaseSchema(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/database/query - Execute SQL SELECT query
      if (path === '/api/admin/database/query' && request.method === 'POST') {
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ sql: string }>(request, ['sql']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.executeQuery(user.userId, body.sql);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/database/tables/:tableName - View table data with pagination
      const tableDataMatch = path.match(/^\/api\/admin\/database\/tables\/([^\/]+)$/);
      if (tableDataMatch && tableDataMatch[1] && request.method === 'GET') {
        const tableName = tableDataMatch[1];
        const user = await this.validateSession(request);

        // Parse query parameters
        const params = new URL(request.url).searchParams;
        const page = parseInt(params.get('page') || '1');
        const pageSize = parseInt(params.get('pageSize') || '50');
        const orderBy = params.get('orderBy') || undefined;
        const orderDir = (params.get('orderDir') as 'ASC' | 'DESC') || 'ASC';

        const result = await this.env.ADMIN_SERVICE.getTableData(user.userId, tableName, {
          page,
          pageSize,
          orderBy,
          orderDir,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 2: VECTOR & EMBEDDING VERIFICATION ENDPOINTS ======

      // GET /api/admin/vectors/stats - Get vector index statistics
      if (path === '/api/admin/vectors/stats' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getVectorIndexStats(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/vectors/embedding-status - Get embedding generation status
      if (path === '/api/admin/vectors/embedding-status' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getEmbeddingStatus(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/vectors/search-test - Test vector search functionality
      if (path === '/api/admin/vectors/search-test' && request.method === 'POST') {
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ query: string; topK?: number }>(request, ['query']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.testVectorSearch(
          user.userId,
          body.query,
          body.topK || 5
        );
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/vectors/service-health - Check embedding service health
      if (path === '/api/admin/vectors/service-health' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getEmbeddingServiceHealth(user.userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 3: SMARTBUCKET MANAGEMENT ENDPOINTS ======

      // GET /api/admin/buckets/:name/objects - List bucket objects
      const listObjectsMatch = path.match(/^\/api\/admin\/buckets\/([^\/]+)\/objects$/);
      if (listObjectsMatch && listObjectsMatch[1] && request.method === 'GET') {
        const bucketName = listObjectsMatch[1];
        const user = await this.validateSession(request);

        // Parse query parameters
        const params = new URL(request.url).searchParams;
        const prefix = params.get('prefix') || undefined;
        const limit = parseInt(params.get('limit') || '100');
        const continuationToken = params.get('continuationToken') || undefined;

        const result = await this.env.ADMIN_SERVICE.listBucketObjects(user.userId, bucketName, {
          prefix,
          limit,
          continuationToken,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/buckets/:name/objects/:key - Get specific bucket object
      const getObjectMatch = path.match(/^\/api\/admin\/buckets\/([^\/]+)\/objects\/(.+)$/);
      if (getObjectMatch && getObjectMatch[1] && getObjectMatch[2] && request.method === 'GET') {
        const bucketName = getObjectMatch[1];
        const key = decodeURIComponent(getObjectMatch[2]);
        const user = await this.validateSession(request);

        const result = await this.env.ADMIN_SERVICE.getBucketObject(user.userId, bucketName, key);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // DELETE /api/admin/buckets/:name/objects - Delete bucket objects
      const deleteObjectsMatch = path.match(/^\/api\/admin\/buckets\/([^\/]+)\/objects$/);
      if (deleteObjectsMatch && deleteObjectsMatch[1] && request.method === 'DELETE') {
        const bucketName = deleteObjectsMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ keys: string[] }>(request, ['keys']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        if (!Array.isArray(body.keys)) {
          return new Response(JSON.stringify({ error: 'keys array is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.ADMIN_SERVICE.deleteBucketObjects(
          user.userId,
          bucketName,
          body.keys
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/buckets/:name/search - Search bucket content
      const searchBucketMatch = path.match(/^\/api\/admin\/buckets\/([^\/]+)\/search$/);
      if (searchBucketMatch && searchBucketMatch[1] && request.method === 'POST') {
        const bucketName = searchBucketMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ query: string; limit?: number }>(request, ['query']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.searchBucket(
          user.userId,
          bucketName,
          body.query,
          body.limit || 10
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/buckets/:name/cleanup - Clean up orphaned objects
      const cleanupBucketMatch = path.match(/^\/api\/admin\/buckets\/([^\/]+)\/cleanup$/);
      if (cleanupBucketMatch && cleanupBucketMatch[1] && request.method === 'POST') {
        const bucketName = cleanupBucketMatch[1];
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{ dryRun?: boolean }>(request);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.cleanupOrphanedObjects(
          user.userId,
          bucketName,
          body.dryRun !== false // Default to true (dry run)
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 4: ERROR LOGS & DEBUGGING ENDPOINTS ======

      // GET /api/admin/logs/errors - Get application error logs
      if (path === '/api/admin/logs/errors' && request.method === 'GET') {
        const user = await this.validateSession(request);

        // Parse query parameters
        const searchParams = url.searchParams;
        const options = {
          startTime: searchParams.get('startTime')
            ? parseInt(searchParams.get('startTime')!)
            : undefined,
          endTime: searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined,
          service: searchParams.get('service') || undefined,
          severity: (searchParams.get('severity') as 'error' | 'warn' | 'info') || undefined,
          limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
          offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
        };

        const result = await this.env.ADMIN_SERVICE.getErrorLogs(user.userId, options);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/health - Get overall system health dashboard
      if (path === '/api/admin/health' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getSystemHealth(user.userId);

        return this.trackAndReturn(
          operation,
          startTime,
          new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        );
      }

      // GET /api/admin/metrics/performance - Get performance metrics
      if (path === '/api/admin/metrics/performance' && request.method === 'GET') {
        const user = await this.validateSession(request);

        // Parse query parameters
        const searchParams = url.searchParams;
        const options = {
          startTime: searchParams.get('startTime')
            ? parseInt(searchParams.get('startTime')!)
            : undefined,
          endTime: searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined,
          operation: searchParams.get('operation') || undefined,
          groupBy: (searchParams.get('groupBy') as 'hour' | 'day' | 'operation') || undefined,
          limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
        };

        const result = await this.env.ADMIN_SERVICE.getPerformanceMetrics(user.userId, options);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ====== PHASE 5: MIGRATIONS, EXPORTS & BACKUPS ENDPOINTS ======

      // GET /api/admin/backup/export/:tableName - Export database table
      const exportTableMatch = path.match(/^\/api\/admin\/backup\/export\/([^\/]+)$/);
      if (exportTableMatch && exportTableMatch[1] && request.method === 'GET') {
        const tableName = exportTableMatch[1];
        const user = await this.validateSession(request);

        const searchParams = url.searchParams;
        const format = (searchParams.get('format') as 'json' | 'csv') || 'json';

        const result = await this.env.ADMIN_SERVICE.exportTable(user.userId, tableName, format);

        // Return as downloadable file
        return new Response(result.data, {
          headers: {
            'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            ...corsHeaders,
          },
        });
      }

      // POST /api/admin/backup/create - Create full database backup
      if (path === '/api/admin/backup/create' && request.method === 'POST') {
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          includeTables?: string[];
          excludeTables?: string[];
        }>(request);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.createBackup(user.userId, body);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/backup/list - List available backups
      if (path === '/api/admin/backup/list' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.listBackups(user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/backup/stats - Get database statistics
      if (path === '/api/admin/backup/stats' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getDatabaseStats(user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/admin/migrations - Get migration status
      if (path === '/api/admin/migrations' && request.method === 'GET') {
        const user = await this.validateSession(request);
        const result = await this.env.ADMIN_SERVICE.getMigrationStatus(user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/backup/import - Import backup data
      if (path === '/api/admin/backup/import' && request.method === 'POST') {
        const user = await this.validateSession(request);

        // CRITICAL FIX: Safe JSON parsing with field validation
        const parseResult = await this.safeParseJSON<{
          backupData: string;
          dryRun?: boolean;
          overwrite?: boolean;
          includeTables?: string[];
          excludeTables?: string[];
        }>(request, ['backupData']);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: (parseResult as any).error }), {
            status: (parseResult as any).status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const body = parseResult.data;

        const result = await this.env.ADMIN_SERVICE.importBackup(user.userId, body.backupData, {
          dryRun: body.dryRun,
          overwrite: body.overwrite,
          includeTables: body.includeTables,
          excludeTables: body.excludeTables,
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/cleanup/orphaned-vectors - Clean up orphaned vectors
      if (path === '/api/admin/cleanup/orphaned-vectors' && request.method === 'POST') {
        try {
          const user = await this.validateSession(request);
          const result = await this.env.ADMIN_SERVICE.cleanupOrphanedVectors(user.userId);

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          return new Response(JSON.stringify({ error: errorMessage }), {
            status: error instanceof Error && error.message === 'Access denied' ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // POST /api/admin/test/phase1-vectors - Run Phase 1 vector migration tests
      if (path === '/api/admin/test/phase1-vectors' && request.method === 'POST') {
        try {
          const user = await this.validateSession(request);
          
          this.env.logger.info('Starting Phase 1 Vector Tests', {
            userId: user.userId,
            email: user.email
          });

          // Import and run tests dynamically
          const { RaindropVectorTester } = await import('../test-raindrop-vectors');
          const tester = new RaindropVectorTester(this.env);
          const results = await tester.runAllTests();

          return this.trackAndReturn(
            operation,
            startTime,
            new Response(JSON.stringify(results), {
              status: results.failed === 0 ? 200 : 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.trackPerformance(operation, startTime, false, errorMessage);

          this.env.logger.error('Phase 1 test execution failed', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
          });

          return new Response(JSON.stringify({ 
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
          }), {
            status: error instanceof Error && error.message === 'Access denied' ? 403 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // Track 404 as failed request
      await this.trackPerformance(operation, startTime, false, 'Not Found');

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (error) {
      const origin = request.headers.get('Origin');
      const corsHeaders = getCorsHeaders(origin);

      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';

      // Track failed request
      await this.trackPerformance(operation, startTime, false, errorMessage, {
        path: url.pathname,
        method: request.method,
      });

      // Log error details
      this.env.logger.error('API Gateway error', {
        path: url.pathname,
        method: request.method,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      const status =
        error instanceof Error
          ? errorMessage.includes('Access denied')
            ? 403
            : errorMessage.includes('not found')
            ? 404
            : 500
          : 500;

      return new Response(JSON.stringify({ error: errorMessage }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  private getSessionId(request: Request): string | null {
    // First check for Authorization Bearer token
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const match = authHeader.match(/Bearer\s+(.+)/i);
      if (match?.[1]) {
        return match[1];
      }
    }

    // Fall back to cookie-based session
    const cookie = request.headers.get('Cookie');
    if (!cookie) return null;

    const match = cookie.match(/session=([^;]+)/);
    return match?.[1] ?? null;
  }

  private async validateSession(request: Request): Promise<{ userId: string; email: string }> {
    const sessionId = this.getSessionId(request);
    if (!sessionId) {
      throw new Error('Access denied');
    }

    const user = await this.env.AUTH_SERVICE.validateSession(sessionId);
    if (!user) {
      throw new Error('Access denied');
    }

    return user;
  }
}
