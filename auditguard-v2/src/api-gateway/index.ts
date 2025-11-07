import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Kysely } from 'kysely';
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
          INSERT INTO performance_metrics (operation, start_time, end_time, duration, success, metadata, error, created_at)
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

  async fetch(request: Request): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const operation = `${request.method} ${path}`;

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

      // Debug: List documents - No auth for debugging
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
          const body = await request.json() as { documentId: string; workspaceId: string };

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

      // ====== AUTH ENDPOINTS ======
      if (path === '/api/auth/register' && request.method === 'POST') {
        const body = (await request.json()) as { email: string; password: string; name: string };
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
        const body = (await request.json()) as { email: string; password: string };
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

      // ====== WORKSPACE ENDPOINTS ======
      if (path === '/api/workspaces' && request.method === 'POST') {
        const user = await this.validateSession(request);
        const body = (await request.json()) as { name: string; description?: string };
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
          const body = (await request.json()) as { name?: string; description?: string };
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
          const body = (await request.json()) as { email: string; role: 'admin' | 'member' | 'viewer' };
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
          const body = (await request.json()) as { role: 'admin' | 'member' | 'viewer' };
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
            const body = (await request.json()) as {
              file: string;
              filename: string;
              contentType: string;
              category?: 'policy' | 'procedure' | 'evidence' | 'other';
              frameworkId?: number;
            };

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

        this.env.logger.info('Starting document reprocessing', {
          documentId,
          workspaceId,
          userId: user.userId,
          vultrKey: document.vultrKey,
          storageKey: document.storageKey,
        });

        // Call DOCUMENT_SERVICE.processDocument() directly (queue observer is broken)
        // This will trigger AI enrichment, chunking, and re-indexing
        try {
          await this.env.DOCUMENT_SERVICE.processDocument(
            documentId,
            workspaceId,
            user.userId
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Document reprocessed successfully',
              documentId,
            }),
            {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        } catch (error) {
          this.env.logger.error('Document reprocessing failed', {
            documentId,
            error: error instanceof Error ? error.message : String(error),
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to reprocess document',
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
          const body = await request.json() as {
            extractedText: string;
            wordCount: number;
            pageCount?: number;
          };

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

        const body = (await request.json()) as {
          query: string;
          page?: number;
          pageSize?: number;
        };

        if (!body.query) {
          return new Response(JSON.stringify({ error: 'Query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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

        const body = (await request.json()) as { question: string };

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

        const body = (await request.json()) as {
          query: string;
          documentId?: string;
        };

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

        const body = (await request.json()) as {
          requestId: string;
          page: number;
          pageSize?: number;
        };

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

        const body = (await request.json()) as {
          requestId: string;
          page: number;
          pageSize?: number;
        };

        if (!body.requestId || body.page === undefined) {
          return new Response(JSON.stringify({ error: 'RequestId and page are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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

        const body = (await request.json()) as {
          text?: string;
          images?: string;
          audio?: string;
          contentTypes?: string[];
        };

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

        const body = (await request.json()) as {
          query: string;
          frameworkId?: number;
          topK?: number;
          minScore?: number;
          includeChunks?: boolean;
          page?: number;
          pageSize?: number;
        };

        if (!body.query) {
          return new Response(JSON.stringify({ error: 'Query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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
          const body = (await request.json()) as {
            filename?: string;
            category?: 'policy' | 'procedure' | 'evidence' | 'other';
          };
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

        const body = (await request.json()) as {
          framework: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS' | 'ISO_27001' | 'NIST_CSF' | 'CCPA' | 'FERPA' | 'GLBA' | 'FISMA' | 'PIPEDA' | 'COPPA' | 'SOX';
        };

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

      // Match /api/workspaces/:id/documents/:documentId/framework (assign framework to document)
      const assignFrameworkMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/documents\/([^\/]+)\/framework$/);
      if (assignFrameworkMatch && assignFrameworkMatch[1] && assignFrameworkMatch[2] && request.method === 'PUT') {
        const workspaceId = assignFrameworkMatch[1];
        const documentId = assignFrameworkMatch[2];
        const user = await this.validateSession(request);

        const body = (await request.json()) as { frameworkId: number };

        if (!body.frameworkId) {
          return new Response(JSON.stringify({ error: 'Framework ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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

        const body = (await request.json()) as {
          frameworkId: number;
          relevanceScore?: number;
        };

        if (!body.frameworkId) {
          return new Response(JSON.stringify({ error: 'Framework ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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

        const body = (await request.json()) as {
          status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
          assignedTo?: string;
        };

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

      // ====== ASSISTANT ENDPOINTS ======
      // Match /api/workspaces/:id/assistant/chat
      const assistantChatMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/chat$/);
      if (assistantChatMatch && assistantChatMatch[1] && request.method === 'POST') {
        const workspaceId = assistantChatMatch[1];
        const user = await this.validateSession(request);

        const body = (await request.json()) as {
          message: string;
          sessionId?: string;
        };

        if (!body.message) {
          return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.ASSISTANT_SERVICE.chat(workspaceId, user.userId, body);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/assistant/sessions
      const assistantSessionsMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/sessions$/);
      if (assistantSessionsMatch && assistantSessionsMatch[1] && request.method === 'GET') {
        const workspaceId = assistantSessionsMatch[1];
        const user = await this.validateSession(request);

        const result = await this.env.ASSISTANT_SERVICE.listSessions(workspaceId, user.userId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Match /api/workspaces/:id/assistant/sessions/:sessionId
      const assistantSessionMatch = path.match(/^\/api\/workspaces\/([^\/]+)\/assistant\/sessions\/([^\/]+)$/);
      if (assistantSessionMatch && assistantSessionMatch[1] && assistantSessionMatch[2]) {
        const workspaceId = assistantSessionMatch[1];
        const sessionId = assistantSessionMatch[2];
        const user = await this.validateSession(request);

        if (request.method === 'GET') {
          const result = await this.env.ASSISTANT_SERVICE.getSessionHistory(sessionId, workspaceId, user.userId);

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          const result = await this.env.ASSISTANT_SERVICE.deleteSession(sessionId, workspaceId, user.userId);

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
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
          const body = (await request.json()) as {
            planId: string;
            paymentMethodId?: string;
          };
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
          const body = (await request.json()) as { planId: string };
          const result = await this.env.BILLING_SERVICE.updateSubscription(user.userId, {
            workspaceId,
            planId: body.planId,
          });
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'DELETE') {
          const body = (await request.json()) as { cancelAtPeriodEnd?: boolean };
          const result = await this.env.BILLING_SERVICE.cancelSubscription(user.userId, {
            workspaceId,
            cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? true,
          });
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
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

        const result = await this.env.USAGE_SERVICE.checkLimits(workspaceId);
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
        const body = (await request.json()) as { value: string };

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
            [999]  // Fake chunk ID
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
        const body = (await request.json()) as { query: string };

        if (!body.query) {
          return new Response(JSON.stringify({ error: 'Query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const result = await this.env.ADMIN_SERVICE.queryAnalytics(user.userId, body.query);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/admin/create - Create new admin user (super_admin only)
      if (path === '/api/admin/create' && request.method === 'POST') {
        const user = await this.validateSession(request);
        const body = (await request.json()) as {
          userId: string;
          role: 'super_admin' | 'support' | 'billing_admin';
          permissions: string[];
        };

        if (!body.userId || !body.role) {
          return new Response(JSON.stringify({ error: 'userId and role are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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
        const body = (await request.json()) as { sql: string };

        if (!body.sql) {
          return new Response(JSON.stringify({ error: 'SQL query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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
        const body = (await request.json()) as { query: string; topK?: number };

        if (!body.query) {
          return new Response(JSON.stringify({ error: 'Query text is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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
        const body = (await request.json()) as { keys: string[] };

        if (!body.keys || !Array.isArray(body.keys)) {
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
        const body = (await request.json()) as { query: string; limit?: number };

        if (!body.query) {
          return new Response(JSON.stringify({ error: 'query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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
        const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };

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
        const body = (await request.json().catch(() => ({}))) as {
          includeTables?: string[];
          excludeTables?: string[];
        };

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
        const body = (await request.json()) as {
          backupData: string;
          dryRun?: boolean;
          overwrite?: boolean;
          includeTables?: string[];
          excludeTables?: string[];
        };

        if (!body.backupData) {
          return new Response(JSON.stringify({ error: 'backupData is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

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
