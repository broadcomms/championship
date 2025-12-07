import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type documents = {
    id: string;
    workspace_id: string;
    filename: string;
    title: string | null;
    description: string | null;
    file_size: number;
    content_type: string;
    category: string | null;
    storage_key: string;
    extracted_text_key: string | null;
    original_file_url: string | null;
    extraction_status: string | null;
    page_count: number | null;
    word_count: number | null;
    uploaded_by: string;
    uploaded_at: number;
    updated_at: number;
    processing_status: string;
    text_extracted: number;
    chunk_count: number;
    extracted_text: string | null;
    character_count: number | null;
    corrected_text: string | null;
    corrected_at: number | null;
    corrected_by: string | null;
    corrections_count: number | null;
};

export type sessions = {
    id: string;
    user_id: string;
    expires_at: number;
    created_at: number;
};

export type users = {
    id: string;
    email: string;
    password_hash: string;
    name: string | null;
    password_reset_token: string | null;
    password_reset_expires: number | null;
    created_at: number;
    updated_at: number;
    workspace_count: number | null;
    last_login: number | null;
    is_active: number | null;
    workos_user_id: string | null;
    oauth_provider: string | null;
    oauth_profile_data: string | null;
    profile_picture_url: string | null;
};

export type NotificationType = 
    // AI Types
    | 'ai_compliance_alert'
    | 'ai_recommendation'
    | 'ai_issue_detected'
    | 'ai_report_ready'
    | 'ai_insight'
    // Workspace Types
    | 'issue_assigned'
    | 'comment'
    | 'mention'
    | 'status_change'
    | 'workspace_invite'
    | 'due_date_reminder'
    | 'overdue_alert';

export type NotificationCategory = 'ai' | 'workspace' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationSource = 'ai_assistant' | 'workspace' | 'system';

export type notifications = {
    id: string;
    user_id: string;
    type: NotificationType;
    category: NotificationCategory;
    priority: NotificationPriority;
    source: NotificationSource;
    title: string;
    message: string;
    read: number;
    action_url: string;
    metadata: string | null;
    workspace_id: string | null;
    ai_session_id: string | null;
    ai_context: string | null; // JSON: {compliance_framework?, issue_count?, severity?}
    actions: string | null; // JSON array: [{id, label, action, style}]
    archived: number;
    snoozed_until: number | null;
    created_at: number;
    read_at: number | null;
};

export type notification_preferences = {
    user_id: string;
    email_issue_assigned: 'instant' | 'daily' | 'weekly' | 'never';
    email_comments: 'instant' | 'daily' | 'weekly' | 'never';
    email_mentions: 'instant' | 'daily' | 'weekly' | 'never';
    email_due_date: 'instant' | 'daily' | 'weekly' | 'never';
    email_status_change: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_compliance_alert: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_recommendation: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_issue_detected: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_report_ready: 'instant' | 'daily' | 'weekly' | 'never';
    email_ai_insight: 'instant' | 'daily' | 'weekly' | 'never';
    in_app_enabled: number;
    in_app_sound: number;
    browser_push_enabled: number;
    updated_at: number;
};

export type workspace_members = {
    workspace_id: string;
    user_id: string;
    role: string;
    added_at: number;
    added_by: string;
};

export type workspace_invitations = {
    id: string;
    workspace_id: string;
    email: string;
    role: string;
    invited_by: string;
    invitation_token: string;
    status: string;
    expires_at: number;
    accepted_at: number | null;
    accepted_by: string | null;
    created_at: number;
};

export type workspaces = {
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    organization_id: string | null;
    created_at: number;
    updated_at: number;
};

export type organizations = {
    id: string;
    name: string;
    slug: string;
    owner_user_id: string;
    stripe_customer_id: string | null;
    billing_email: string | null;
    created_at: number;
    updated_at: number;
};

export type organization_members = {
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    joined_at: number;
    invited_by: string | null;
};

export type sso_connections = {
    id: string;
    organization_id: string;
    provider: string;
    workos_organization_id: string;
    workos_connection_id: string | null;
    enabled: number;
    allowed_domains: string | null;
    created_at: number;
    updated_at: number;
};

export type organization_usage_daily = {
    id: string;
    organization_id: string;
    date: string;
    documents_created: number;
    documents_total: number;
    compliance_checks_count: number;
    api_calls_count: number;
    assistant_messages_count: number;
    storage_bytes: number;
    created_at: number;
    updated_at: number;
};

export type compliance_checks = {
    id: string;
    document_id: string;
    workspace_id: string;
    framework: string;
    status: string;
    overall_score: number | null;
    issues_found: number;
    created_at: number;
    completed_at: number | null;
    created_by: string;
    llm_response: string | null;
};

export type compliance_frameworks = {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    settings: string | null;
    is_active: number;
    created_at: number;
    updated_at: number;
};

export type compliance_issues = {
    id: string;
    check_id: string;
    document_id: string;
    workspace_id: string | null;
    framework: string | null;
    regulation_citation: string | null;
    excerpt: string | null;
    risk_score: number | null;
    section_ref: string | null;
    chunk_ids: string | null;
    remediation_steps: string | null;
    full_excerpt: string | null;
    resolution_notes: string | null;
    updated_at: number | null;
    severity: string;
    category: string;
    title: string;
    description: string;
    recommendation: string | null;
    confidence: number;
    priority: number;
    priority_level: string | null; // P1, P2, P3, P4
    location: string | null;
    status: string;
    assigned_to: string | null;
    assigned_at: number | null;
    due_date: number | null;
    resolved_at: number | null;
    resolved_by: string | null;
    created_at: number;
    llm_response: string | null; // Complete LLM JSON response for this issue
    // Issue fingerprinting for deduplication
    issue_fingerprint: string | null;
    is_active: number | null; // SQLite BOOLEAN (1 = true, 0 = false)
    superseded_by: string | null;
    first_detected_check_id: string | null;
    last_confirmed_check_id: string | null;
};

export type issue_comments = {
    id: string;
    issue_id: string;
    workspace_id: string;
    user_id: string;
    comment_text: string;
    comment_type: 'comment' | 'status_change' | 'assignment' | 'resolution' | 'system';
    metadata: string | null; // JSON
    created_at: number;
    updated_at: number;
};

export type document_chunks = {
    id: string;
    document_id: string;
    workspace_id: string;
    chunk_index: number;
    content: string;
    chunk_text: string;  // The actual text content of the chunk
    chunk_size: number;
    created_at: number;
};

export type document_processing_steps = {
    id: string;
    document_id: string;
    step_name: string;
    step_order: number;
    status: string;
    started_at: number | null;
    completed_at: number | null;
    progress_current: number;
    progress_total: number;
    meta_info: string | null;
    error_message: string | null;
    created_at: number;
    updated_at: number;
};

export type workspace_scores = {
    id: string;
    workspace_id: string;
    overall_score: number;
    documents_checked: number;
    total_documents: number;
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
    info_issues: number;
    risk_level: string;
    frameworks_covered: string;
    calculated_at: number;
    calculated_by: string | null;
};

export type framework_scores = {
    id: string;
    workspace_id: string;
    framework: string;
    score: number;
    checks_passed: number;
    checks_failed: number;
    total_checks: number;
    last_check_at: number | null;
    created_at: number;
};

export type conversation_sessions = {
    id: string;
    workspace_id: string;
    user_id: string;
    memory_session_id: string;
    title: string | null;
    started_at: number;
    last_activity_at: number;
    message_count: number;
};

export type conversation_messages = {
    id: string;
    session_id: string;
    role: string;
    content: string;
    created_at: number;
};

export type subscription_plans = {
    id: string;
    name: string;
    display_name: string;
    description: string | null;
    price_monthly: number;
    price_yearly: number;
    stripe_price_id_monthly: string | null;
    stripe_price_id_yearly: string | null;
    features: string;
    limits: string;
    is_active: number;
    created_at: number;
    max_workspaces: number | null;
};

export type subscriptions = {
    id: string;
    organization_id: string;  // Organization-level subscriptions only
    plan_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: number;
    trial_end: number | null;
    trial_start: number | null;
    canceled_at: number | null;
    created_at: number;
    updated_at: number;
};

export type usage_tracking = {
    id: string;
    workspace_id: string;
    resource_type: string;
    resource_id: string | null;
    user_id: string | null;
    meta_info: string | null;
    tracked_at: number;
};

export type usage_summaries = {
    id: string;
    workspace_id: string;
    date: string;
    api_calls: number;
    documents_uploaded: number;
    compliance_checks: number;
    assistant_messages: number;
    storage_bytes: number;
    created_at: number;
    updated_at: number;
};

export type admin_users = {
    user_id: string;
    role: string;
    permissions: string;
    created_at: number;
    created_by: string | null;
};

export type system_settings = {
    key: string;
    value: string;
    value_type: string;
    description: string | null;
    updated_at: number;
    updated_by: string | null;
};

export type admin_audit_log = {
    id: string;
    admin_user_id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    changes: string | null;
    ip_address: string | null;
    created_at: number;
};

export type issue_assignments = {
    id: string;
    issue_id: string;
    workspace_id: string;
    assigned_by: string;
    assigned_to: string;
    assigned_at: number;
    unassigned_at: number | null;
    notes: string | null;
    notification_sent: number;
};

export type issue_status_history = {
    id: string;
    issue_id: string;
    workspace_id: string;
    old_status: string | null;
    new_status: string;
    changed_by: string;
    changed_at: number;
    notes: string | null;
};

export type document_compliance_cache = {
    id: string;
    workspace_id: string;
    document_id: string;
    framework: string;
    overall_score: number | null;
    risk_level: string | null;
    total_issues: number;
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
    open_issues: number;
    resolved_issues: number;
    last_check_id: string | null;
    last_analyzed_at: number;
    expires_at: number | null;
};

export type compliance_reports = {
    id: string;
    workspace_id: string;
    name: string;
    created_at: number;
    created_by: string;
    frameworks: string; // JSON array
    report_period: string; // JSON object
    summary: string; // JSON object
    status: string;
};

export type knowledge_base = {
    id: string;
    title: string;
    content: string;
    category: 'framework_guide' | 'compliance_article' | 'best_practice';
    framework: 'gdpr' | 'soc2' | 'hipaa' | 'iso27001' | 'nist_csf' | 'pci_dss' | null;
    tags: string; // JSON array as string
    created_at: number;
    updated_at: number;
    created_by: string | null;
    is_active: number; // 1 = active, 0 = deleted
    sort_order: number;
};

export type stripe_customers = {
    id: string;
    workspace_id: string;
    stripe_customer_id: string;
    email: string;
    payment_method_id: string | null;
    created_at: number;
    updated_at: number;
};

export type stripe_payment_methods = {
    id: string;
    workspace_id: string;
    stripe_payment_method_id: string;
    type: string;
    last4: string | null;
    brand: string | null;
    exp_month: number | null;
    exp_year: number | null;
    is_default: number;
    created_at: number;
};

export type billing_history = {
    id: string;
    organization_id: string; // Fixed: matches actual DB schema
    stripe_invoice_id: string | null;
    stripe_charge_id: string | null;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    invoice_pdf: string | null;
    period_start: number | null;
    period_end: number | null;
    created_at: number;
};

export type compliance_trends = {
    id: string;
    workspace_id: string;
    date: string;
    overall_score: number;
    framework_scores: string;
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
    total_documents: number;
    documents_checked: number;
    data_source: string | null;
    created_at: number;
};

export type proactive_notifications = {
    id: string;
    workspace_id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    trigger_condition: string;
    trigger_value: string | null;
    metadata: string;
    acknowledged: number;
    acknowledged_by: string | null;
    acknowledged_at: number | null;
    expires_at: number | null;
    created_at: number;
};

export type assistant_analytics_daily = {
    id: string;
    workspace_id: string;
    date: string;
    query_count: number;
    tool_calls: number;
    avg_response_time: number;
    unique_users: number;
    created_at: number;
};

export type tool_usage_analytics = {
    id: string;
    workspace_id: string;
    tool_name: string;
    user_id: string;
    execution_time: number;
    success: number;
    error_message: string | null;
    executed_at: number;
};

export type DB = {
    documents: documents;
    sessions: sessions;
    users: users;
    notifications: notifications;
    notification_preferences: notification_preferences;
    workspace_members: workspace_members;
    workspace_invitations: workspace_invitations;
    workspaces: workspaces;
    organizations: organizations;
    organization_members: organization_members;
    sso_connections: sso_connections;
    organization_usage_daily: organization_usage_daily;
    compliance_checks: compliance_checks;
    compliance_frameworks: compliance_frameworks;
    compliance_issues: compliance_issues;
    issue_comments: issue_comments;
    compliance_reports: compliance_reports;
    knowledge_base: knowledge_base;
    document_chunks: document_chunks;
    document_processing_steps: document_processing_steps;
    workspace_scores: workspace_scores;
    framework_scores: framework_scores;
    conversation_sessions: conversation_sessions;
    conversation_messages: conversation_messages;
    subscription_plans: subscription_plans;
    subscriptions: subscriptions;
    stripe_customers: stripe_customers;
    stripe_payment_methods: stripe_payment_methods;
    billing_history: billing_history;
    usage_tracking: usage_tracking;
    usage_summaries: usage_summaries;
    admin_users: admin_users;
    system_settings: system_settings;
    admin_audit_log: admin_audit_log;
    issue_assignments: issue_assignments;
    issue_status_history: issue_status_history;
    document_compliance_cache: document_compliance_cache;
    compliance_trends: compliance_trends;
    proactive_notifications: proactive_notifications;
    assistant_analytics_daily: assistant_analytics_daily;
    tool_usage_analytics: tool_usage_analytics;
};
