'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { api } from '@/lib/api';
import { AlertTriangle, Info, Building2 } from 'lucide-react';
import { OrganizationWithRole } from '@/types/organization';

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

type CreateWorkspaceForm = z.infer<typeof createWorkspaceSchema>;

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface WorkspaceLimits {
  currentCount: number;
  maxWorkspaces: number;
  planName: string;
  isAtLimit: boolean;
}

export function CreateWorkspaceDialog({ isOpen, onClose, onSuccess }: CreateWorkspaceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [limits, setLimits] = useState<WorkspaceLimits | null>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateWorkspaceForm>({
    resolver: zodResolver(createWorkspaceSchema),
  });

  // Fetch organizations and workspace limits when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
      fetchWorkspaceLimits();
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    try {
      const data = await api.get<OrganizationWithRole[]>('/api/organizations');
      setOrganizations(data);

      // Auto-select the first organization (or the owner organization if exists)
      if (data.length > 0) {
        const ownerOrg = data.find(org => org.role === 'owner');
        setSelectedOrgId(ownerOrg?.id || data[0].id);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch organizations:', err);
      setError('Failed to load organizations. Please try again.');
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const fetchWorkspaceLimits = async () => {
    setIsLoadingLimits(true);
    try {
      const data = await api.get<WorkspaceLimits>('/api/workspaces/limits');
      setLimits(data);
    } catch (err: unknown) {
      console.error('Failed to fetch workspace limits:', err);
      // Don't show error to user, just log it
    } finally {
      setIsLoadingLimits(false);
    }
  };

  const onSubmit = async (data: CreateWorkspaceForm) => {
    setIsSubmitting(true);
    setError('');

    try {
      // Send organization_id along with workspace data
      await api.post('/api/workspaces', {
        ...data,
        organization_id: selectedOrgId,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const rawMessage =
        (typeof err === 'object' && err && 'error' in err && typeof (err as { error?: string }).error === 'string'
          ? (err as { error?: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to create workspace');
      const safeMessage = rawMessage && rawMessage.trim().length > 0 ? rawMessage : 'Failed to create workspace';
      setError(safeMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError('');
    setLimits(null);
    onClose();
  };

  if (!isOpen) return null;

  const showLimitWarning = limits && !limits.isAtLimit && limits.currentCount > 0;
  const showLimitError = limits && limits.isAtLimit;
  const usagePercentage = limits ? (limits.currentCount / (limits.maxWorkspaces === -1 ? 100 : limits.maxWorkspaces)) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Create New Workspace</h2>
          <p className="mt-1 text-sm text-gray-600">
            Create a workspace to organize your compliance documents and team.
          </p>
        </div>

        {/* Workspace Usage Warning */}
        {isLoadingLimits && (
          <div className="mb-4 animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="h-4 w-3/4 rounded bg-gray-300"></div>
          </div>
        )}

        {showLimitWarning && !isLoadingLimits && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900">
                  Workspace Usage
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  You have <span className="font-bold">{limits.currentCount}</span> workspace{limits.currentCount !== 1 ? 's' : ''}.
                  Your <span className="font-semibold">{limits.planName}</span> plan allows{' '}
                  <span className="font-bold">
                    {limits.maxWorkspaces === -1 ? 'unlimited' : limits.maxWorkspaces}
                  </span>{' '}
                  workspace{limits.maxWorkspaces !== 1 ? 's' : ''} total.
                </p>
                {limits.maxWorkspaces !== -1 && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-amber-700">
                      <span>Usage</span>
                      <span className="font-medium">
                        {limits.currentCount} / {limits.maxWorkspaces}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          usagePercentage >= 80 ? 'bg-amber-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showLimitError && !isLoadingLimits && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900">
                  Workspace Limit Reached
                </h3>
                <p className="mt-1 text-sm text-red-800">
                  You&rsquo;ve reached your limit of <span className="font-bold">{limits.maxWorkspaces}</span> workspace
                  {limits.maxWorkspaces !== 1 ? 's' : ''} on the <span className="font-semibold">{limits.planName}</span> plan.
                  Please upgrade your plan to create more workspaces.
                </p>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      window.location.href = '/pricing';
                    }}
                  >
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Organization Selector */}
          {isLoadingOrgs ? (
            <div className="animate-pulse">
              <div className="h-4 w-24 rounded bg-gray-300 mb-2"></div>
              <div className="h-10 w-full rounded-md bg-gray-300"></div>
            </div>
          ) : organizations.length > 0 ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Organization
              </label>
              {organizations.length === 1 ? (
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-900">{organizations[0].name}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {organizations[0].workspace_count} workspace{organizations[0].workspace_count !== 1 ? 's' : ''}
                  </span>
                </div>
              ) : (
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.workspace_count} workspace{org.workspace_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-gray-500">
                This workspace will be created under the selected organization
              </p>
            </div>
          ) : null}

          {/* Workspace Name */}
          <div>
            <Input
              label="Workspace Name"
              placeholder="e.g., ACME Corp Compliance"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (Optional)
            </label>
            <textarea
              placeholder="Brief description of this workspace..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('description')}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              loading={isSubmitting}
              disabled={showLimitError || isSubmitting}
            >
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
