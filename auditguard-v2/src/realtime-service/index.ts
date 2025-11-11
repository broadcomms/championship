/**
 * Real-Time Notification Service (PHASE 4.2.1)
 * 
 * Provides WebSocket connections for real-time updates:
 * - Compliance check progress and completion
 * - Dashboard metric updates
 * - Issue status changes
 * - Document processing status
 * 
 * Uses in-worker connection management (simplified for MVP)
 */

import { z } from 'zod';
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

// Message types for type-safe communication
export const MessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ping'),
  }),
  z.object({
    type: z.literal('pong'),
  }),
  z.object({
    type: z.literal('subscribe'),
    channel: z.string(),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    channel: z.string(),
  }),
  z.object({
    type: z.literal('compliance_check_update'),
    data: z.object({
      checkId: z.string(),
      workspaceId: z.string(),
      status: z.enum(['pending', 'running', 'completed', 'failed']),
      progress: z.number().optional(),
      issuesFound: z.number().optional(),
      overallScore: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal('dashboard_update'),
    data: z.object({
      workspaceId: z.string(),
      overallScore: z.number(),
      totalIssues: z.number(),
      openIssues: z.number(),
    }),
  }),
  z.object({
    type: z.literal('issue_update'),
    data: z.object({
      issueId: z.string(),
      workspaceId: z.string(),
      status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
      assignedTo: z.string().nullable().optional(),
    }),
  }),
  z.object({
    type: z.literal('document_processing_update'),
    data: z.object({
      documentId: z.string(),
      workspaceId: z.string(),
      status: z.enum(['pending', 'processing', 'completed', 'failed']),
      progress: z.number().optional(),
    }),
  }),
]);

export type Message = z.infer<typeof MessageSchema>;

// Global connection store (per-worker)
// workspaceId -> sessionId -> WebSocket
const workspaceConnections = new Map<string, Map<string, any>>();

// Channel subscriptions: workspaceId -> channel -> Set<sessionId>
const workspaceSubscriptions = new Map<string, Map<string, Set<string>>>();

/**
 * WebSocket Service
 */
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extract workspace ID from path: /ws/:workspaceId/realtime
    const pathMatch = path.match(/^\/ws\/([^/]+)\/realtime$/);
    if (!pathMatch) {
      return new Response('Not found', { status: 404 });
    }

    const workspaceId = pathMatch[1];

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      // @ts-ignore - Cloudflare Workers WebSocket API
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.handleSession(server as any, workspaceId);

      return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
      });
    }

    // Broadcast HTTP endpoint
    if (request.method === 'POST' && path.includes('/broadcast')) {
      return this.handleBroadcast(request, workspaceId);
    }

    return new Response('Real-time notification service', { status: 200 });
  }

  private handleSession(webSocket: any, workspaceId: string): void {
    // @ts-ignore
    webSocket.accept();

    const sessionId = crypto.randomUUID();

    // Store connection
    if (!workspaceConnections.has(workspaceId)) {
      workspaceConnections.set(workspaceId, new Map());
    }
    workspaceConnections.get(workspaceId)!.set(sessionId, webSocket);

    this.env.logger.info('WebSocket connected', {
      workspaceId,
      sessionId,
      total: workspaceConnections.get(workspaceId)!.size,
    });

    // Message handler
    webSocket.addEventListener('message', async (event: any) => {
      try {
        const message = MessageSchema.parse(JSON.parse(event.data));
        this.handleMessage(sessionId, workspaceId, message, webSocket);
      } catch (error) {
        this.env.logger.error('Invalid message', { workspaceId, sessionId, error });
        webSocket.send(JSON.stringify({ type: 'error', message: 'Invalid format' }));
      }
    });

    // Close handler
    webSocket.addEventListener('close', () => {
      this.env.logger.info('WebSocket closed', { workspaceId, sessionId });

      const connections = workspaceConnections.get(workspaceId);
      if (connections) {
        connections.delete(sessionId);
        if (connections.size === 0) {
          workspaceConnections.delete(workspaceId);
        }
      }

      const subscriptions = workspaceSubscriptions.get(workspaceId);
      if (subscriptions) {
        for (const subscribers of subscriptions.values()) {
          subscribers.delete(sessionId);
        }
      }
    });

    // Error handler
    webSocket.addEventListener('error', (event: any) => {
      this.env.logger.error('WebSocket error', { workspaceId, sessionId, error: event });
    });

    // Welcome message
    webSocket.send(
      JSON.stringify({
        type: 'connected',
        sessionId,
        workspaceId,
        timestamp: Date.now(),
      })
    );
  }

  private handleMessage(
    sessionId: string,
    workspaceId: string,
    message: Message,
    webSocket: any
  ): void {
    switch (message.type) {
      case 'ping':
        webSocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'subscribe':
        this.subscribe(sessionId, workspaceId, message.channel);
        webSocket.send(
          JSON.stringify({
            type: 'subscribed',
            channel: message.channel,
            timestamp: Date.now(),
          })
        );
        this.env.logger.info('Subscribed', {
          workspaceId,
          sessionId,
          channel: message.channel,
        });
        break;

      case 'unsubscribe':
        this.unsubscribe(sessionId, workspaceId, message.channel);
        webSocket.send(
          JSON.stringify({
            type: 'unsubscribed',
            channel: message.channel,
            timestamp: Date.now(),
          })
        );
        this.env.logger.info('Unsubscribed', {
          workspaceId,
          sessionId,
          channel: message.channel,
        });
        break;

      default:
        webSocket.send(
          JSON.stringify({
            type: 'error',
            message: 'Unsupported message type from client',
          })
        );
    }
  }

  private subscribe(sessionId: string, workspaceId: string, channel: string): void {
    if (!workspaceSubscriptions.has(workspaceId)) {
      workspaceSubscriptions.set(workspaceId, new Map());
    }
    const subscriptions = workspaceSubscriptions.get(workspaceId)!;

    if (!subscriptions.has(channel)) {
      subscriptions.set(channel, new Set());
    }
    subscriptions.get(channel)!.add(sessionId);
  }

  private unsubscribe(sessionId: string, workspaceId: string, channel: string): void {
    const subscriptions = workspaceSubscriptions.get(workspaceId);
    if (!subscriptions) return;

    const subscribers = subscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(sessionId);
      if (subscribers.size === 0) {
        subscriptions.delete(channel);
      }
    }
  }

  private async handleBroadcast(request: Request, workspaceId: string): Promise<Response> {
    try {
      const body = (await request.json()) as { channel: string; message: Message };
      const { channel, message } = body;

      if (!channel || !message) {
        return new Response('Missing channel or message', { status: 400 });
      }

      const count = this.broadcast(workspaceId, channel, message);

      this.env.logger.info('Broadcast sent', {
        workspaceId,
        channel,
        messageType: message.type,
        recipients: count,
      });

      return new Response(JSON.stringify({ sent: count }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      this.env.logger.error('Broadcast failed', { workspaceId, error });
      return new Response('Broadcast failed', { status: 500 });
    }
  }

  private broadcast(workspaceId: string, channel: string, message: Message): number {
    const subscriptions = workspaceSubscriptions.get(workspaceId);
    if (!subscriptions) return 0;

    const subscribers = subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) return 0;

    const connections = workspaceConnections.get(workspaceId);
    if (!connections) return 0;

    let sent = 0;
    const messageStr = JSON.stringify(message);

    for (const sessionId of subscribers) {
      const webSocket = connections.get(sessionId);
      if (webSocket) {
        try {
          webSocket.send(messageStr);
          sent++;
        } catch (error) {
          this.env.logger.error('Send failed', { workspaceId, sessionId, error });
          connections.delete(sessionId);
          subscribers.delete(sessionId);
        }
      }
    }

    return sent;
  }
}
