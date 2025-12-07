/**
 * Feature Gate Service - Backend API
 * Provides feature access validation for workspace subscriptions
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import type { Env } from './raindrop.gen';
import { hasFeature, getRequiredPlan, getPlanFeatures, FEATURE_METADATA, type FeatureId, type PlanId } from '../common/feature-gates';

interface FeatureCheckRequest {
  workspace_id: string;
  feature_id: FeatureId;
}

interface FeatureCheckResponse {
  has_access: boolean;
  plan_id: PlanId;
  required_plan?: PlanId;
  status: string;
  trial_end?: number;
  message?: string;
}

interface PlanFeaturesRequest {
  workspace_id: string;
}

interface PlanFeaturesResponse {
  plan_id: PlanId;
  status: string;
  features: FeatureId[];
  trial_end?: number;
  is_trial: boolean;
}

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Check if workspace has access to a specific feature
      if (path === '/check-feature' && request.method === 'POST') {
        const body = await request.json() as FeatureCheckRequest;
        const result = await this.checkFeatureAccess(body.workspace_id, body.feature_id);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // Get all features available to a workspace
      if (path === '/plan-features' && request.method === 'POST') {
        const body = await request.json() as PlanFeaturesRequest;
        const result = await this.getPlanFeaturesForWorkspace(body.workspace_id);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: corsHeaders }
      );
    } catch (error) {
      console.error('Feature gate service error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  /**
   * Check if workspace has access to a specific feature
   */
  private async checkFeatureAccess(
    workspaceId: string,
    featureId: FeatureId
  ): Promise<FeatureCheckResponse> {
    // Get workspace subscription via organization
    const subscription = await this.env.AUDITGUARD_DB.prepare(
      `SELECT s.plan_id, s.status, s.trial_end
       FROM subscriptions s
       INNER JOIN workspaces w ON w.organization_id = s.organization_id
       WHERE w.id = ?
       ORDER BY s.created_at DESC
       LIMIT 1`
    )
      .bind(workspaceId)
      .first<{ plan_id: PlanId; status: string; trial_end: number | null }>();

    if (!subscription) {
      return {
        has_access: false,
        plan_id: 'plan_free',
        status: 'none',
        message: 'No subscription found',
      };
    }

    const hasAccess = hasFeature(subscription.plan_id, featureId);
    const requiredPlan = getRequiredPlan(featureId);

    const response: FeatureCheckResponse = {
      has_access: hasAccess,
      plan_id: subscription.plan_id,
      status: subscription.status,
    };

    if (!hasAccess) {
      response.required_plan = requiredPlan;
      response.message = `Feature requires ${requiredPlan} or higher`;
    }

    if (subscription.trial_end) {
      response.trial_end = subscription.trial_end;
    }

    return response;
  }

  /**
   * Get all features available to a workspace
   */
  private async getPlanFeaturesForWorkspace(
    workspaceId: string
  ): Promise<PlanFeaturesResponse> {
    // Get workspace subscription via organization
    const subscription = await this.env.AUDITGUARD_DB.prepare(
      `SELECT s.plan_id, s.status, s.trial_end
       FROM subscriptions s
       INNER JOIN workspaces w ON w.organization_id = s.organization_id
       WHERE w.id = ?
       ORDER BY s.created_at DESC
       LIMIT 1`
    )
      .bind(workspaceId)
      .first<{ plan_id: PlanId; status: string; trial_end: number | null }>();

    if (!subscription) {
      return {
        plan_id: 'plan_free',
        status: 'none',
        features: getPlanFeatures('plan_free'),
        is_trial: false,
      };
    }

    const response: PlanFeaturesResponse = {
      plan_id: subscription.plan_id,
      status: subscription.status,
      features: getPlanFeatures(subscription.plan_id),
      is_trial: subscription.status === 'trialing',
    };

    if (subscription.trial_end) {
      response.trial_end = subscription.trial_end;
    }

    return response;
  }
}
