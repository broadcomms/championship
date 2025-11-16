export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface OrganizationSettings extends Organization {
  member_count: number;
  workspace_count: number;
  subscription_plan: string | null;
  subscription_status: string | null;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'billing';
  joined_at: number;
  invited_by: string | null;
}

export interface OrganizationWithRole extends Organization {
  role: string;
  member_count: number;
  workspace_count: number;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  billing_email?: string;
}

export interface AddOrganizationMemberInput {
  email: string;
  role: 'admin' | 'member' | 'billing';
}
