/**
 * Feature Gating System for Plan-Based Access Control
 * Phase 4: Conversion Optimization
 */

export type PlanId = 'plan_free' | 'plan_starter' | 'plan_professional' | 'plan_business' | 'plan_enterprise';

export type FeatureId =
  // Free tier features
  | 'basic_frameworks'
  | 'pdf_export_single'
  | 'document_upload'
  | 'basic_compliance_checks'
  
  // Starter tier features
  | 'all_frameworks'
  | 'email_support'
  | 'pdf_export_multiple'
  | 'email_notifications'
  | 'version_control_7days'
  
  // Professional tier features
  | 'advanced_analytics'
  | 'team_collaboration'
  | 'api_access'
  | 'slack_integration'
  | 'custom_branding'
  | 'version_control_30days'
  | 'compliance_automation'
  | 'document_templates'
  | 'priority_support'
  
  // Business tier features
  | 'sso'
  | 'custom_frameworks'
  | 'audit_logs'
  | 'advanced_permissions'
  | 'custom_integrations'
  | 'dedicated_account_manager'
  | 'sla_guarantees'
  
  // Enterprise tier features
  | 'white_label'
  | 'on_premise_deployment'
  | 'custom_sla'
  | 'dedicated_infrastructure'
  | 'custom_development';

/**
 * Feature definitions per plan tier
 * Each tier inherits features from lower tiers
 */
const FREE_FEATURES: FeatureId[] = [
  'basic_frameworks',
  'pdf_export_single',
  'document_upload',
  'basic_compliance_checks',
];

const STARTER_FEATURES: FeatureId[] = [
  ...FREE_FEATURES,
  'all_frameworks',
  'email_support',
  'pdf_export_multiple',
  'email_notifications',
  'version_control_7days',
];

const PROFESSIONAL_FEATURES: FeatureId[] = [
  ...STARTER_FEATURES,
  'advanced_analytics',
  'team_collaboration',
  'api_access',
  'slack_integration',
  'custom_branding',
  'version_control_30days',
  'compliance_automation',
  'document_templates',
  'priority_support',
];

const BUSINESS_FEATURES: FeatureId[] = [
  ...PROFESSIONAL_FEATURES,
  'sso',
  'custom_frameworks',
  'audit_logs',
  'advanced_permissions',
  'custom_integrations',
  'dedicated_account_manager',
  'sla_guarantees',
];

const ENTERPRISE_FEATURES: FeatureId[] = [
  ...BUSINESS_FEATURES,
  'white_label',
  'on_premise_deployment',
  'custom_sla',
  'dedicated_infrastructure',
  'custom_development',
];

/**
 * Map of plan IDs to their available features
 */
export const PLAN_FEATURES: Record<PlanId, FeatureId[]> = {
  plan_free: FREE_FEATURES,
  plan_starter: STARTER_FEATURES,
  plan_professional: PROFESSIONAL_FEATURES,
  plan_business: BUSINESS_FEATURES,
  plan_enterprise: ENTERPRISE_FEATURES,
};

/**
 * Check if a plan has access to a specific feature
 */
export function hasFeature(planId: PlanId, featureId: FeatureId): boolean {
  const features = PLAN_FEATURES[planId];
  return features.includes(featureId);
}

/**
 * Get all features available for a plan
 */
export function getPlanFeatures(planId: PlanId): FeatureId[] {
  return PLAN_FEATURES[planId];
}

/**
 * Get the minimum plan required for a feature
 */
export function getRequiredPlan(featureId: FeatureId): PlanId {
  if (FREE_FEATURES.includes(featureId)) return 'plan_free';
  if (STARTER_FEATURES.includes(featureId)) return 'plan_starter';
  if (PROFESSIONAL_FEATURES.includes(featureId)) return 'plan_professional';
  if (BUSINESS_FEATURES.includes(featureId)) return 'plan_business';
  return 'plan_enterprise';
}

/**
 * Feature metadata for display purposes
 */
export const FEATURE_METADATA: Record<FeatureId, { name: string; description: string; badge?: string }> = {
  // Free
  basic_frameworks: { name: 'Basic Frameworks', description: 'GDPR & SOC2 compliance frameworks' },
  pdf_export_single: { name: 'PDF Export', description: 'Export single document to PDF' },
  document_upload: { name: 'Document Upload', description: 'Upload compliance documents' },
  basic_compliance_checks: { name: 'Basic Checks', description: 'Standard compliance analysis' },
  
  // Starter
  all_frameworks: { name: 'All Frameworks', description: 'Access to all compliance frameworks', badge: 'Starter+' },
  email_support: { name: 'Email Support', description: '48-hour response time', badge: 'Starter+' },
  pdf_export_multiple: { name: 'Batch Export', description: 'Export multiple documents', badge: 'Starter+' },
  email_notifications: { name: 'Email Alerts', description: 'Compliance issue notifications', badge: 'Starter+' },
  version_control_7days: { name: 'Version History', description: '7-day version control', badge: 'Starter+' },
  
  // Professional
  advanced_analytics: { name: 'Advanced Analytics', description: 'Detailed compliance insights', badge: 'Professional+' },
  team_collaboration: { name: 'Team Collaboration', description: 'Comments, mentions, and sharing', badge: 'Professional+' },
  api_access: { name: 'API Access', description: '10,000 calls/month', badge: 'Professional+' },
  slack_integration: { name: 'Slack Integration', description: 'Real-time notifications', badge: 'Professional+' },
  custom_branding: { name: 'Custom Branding', description: 'White-label reports', badge: 'Professional+' },
  version_control_30days: { name: 'Extended History', description: '30-day version control', badge: 'Professional+' },
  compliance_automation: { name: 'Automation', description: 'Automated compliance workflows', badge: 'Professional+' },
  document_templates: { name: 'Templates', description: 'Pre-built document templates', badge: 'Professional+' },
  priority_support: { name: 'Priority Support', description: '24-hour response time', badge: 'Professional+' },
  
  // Business
  sso: { name: 'SSO', description: 'SAML & OIDC authentication', badge: 'Business+' },
  custom_frameworks: { name: 'Custom Frameworks', description: 'Build your own frameworks', badge: 'Business+' },
  audit_logs: { name: 'Audit Logs', description: 'Complete activity tracking', badge: 'Business+' },
  advanced_permissions: { name: 'Advanced Permissions', description: 'Granular access control', badge: 'Business+' },
  custom_integrations: { name: 'Custom Integrations', description: 'Bespoke API integrations', badge: 'Business+' },
  dedicated_account_manager: { name: 'Account Manager', description: 'Dedicated support representative', badge: 'Business+' },
  sla_guarantees: { name: 'SLA', description: '99.9% uptime guarantee', badge: 'Business+' },
  
  // Enterprise
  white_label: { name: 'White Label', description: 'Full brand customization', badge: 'Enterprise' },
  on_premise_deployment: { name: 'On-Premise', description: 'Self-hosted deployment', badge: 'Enterprise' },
  custom_sla: { name: 'Custom SLA', description: 'Up to 99.99% uptime', badge: 'Enterprise' },
  dedicated_infrastructure: { name: 'Dedicated Infra', description: 'Isolated infrastructure', badge: 'Enterprise' },
  custom_development: { name: 'Custom Development', description: 'Bespoke feature development', badge: 'Enterprise' },
};

/**
 * Check if user is on trial and has access to professional features
 */
export function isTrialAccess(planId: PlanId, status: string): boolean {
  return status === 'trialing' && planId === 'plan_professional';
}

/**
 * Get upgrade message for a locked feature
 */
export function getUpgradeMessage(featureId: FeatureId, currentPlan: PlanId): string {
  const requiredPlan = getRequiredPlan(featureId);
  const feature = FEATURE_METADATA[featureId];
  
  const planNames: Record<PlanId, string> = {
    plan_free: 'Free',
    plan_starter: 'Starter',
    plan_professional: 'Professional',
    plan_business: 'Business',
    plan_enterprise: 'Enterprise',
  };
  
  return `${feature.name} requires ${planNames[requiredPlan]} plan. Upgrade to unlock this feature.`;
}
