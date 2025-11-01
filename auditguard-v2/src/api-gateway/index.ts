import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

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

        // Get document to retrieve storage key
        const document = await this.env.DOCUMENT_SERVICE.getDocument(documentId, workspaceId, user.userId);

        this.env.logger.info('Enqueueing document for processing', { documentId, workspaceId, userId: user.userId });

        // Enqueue the document for processing with retry support
        await this.env.DOCUMENT_PROCESSING_QUEUE.send({
          documentId,
          workspaceId,
          userId: user.userId,
          storageKey: document.storageKey,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Document queued for processing',
            documentId,
          }),
          {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
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
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
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

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (error) {
      const origin = request.headers.get('Origin');
      const corsHeaders = getCorsHeaders(origin);

      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';

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
