'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { api } from '@/lib/api';

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
});

type InviteMemberForm = z.infer<typeof inviteMemberSchema>;

interface InviteMemberDialogProps {
  isOpen: boolean;
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteMemberDialog({
  isOpen,
  workspaceId,
  onClose,
  onSuccess,
}: InviteMemberDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteMemberForm>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      role: 'member',
    },
  });

  const onSubmit = async (data: InviteMemberForm) => {
    setIsSubmitting(true);
    setError('');

    try {
      await api.post(`/api/workspaces/${workspaceId}/members`, data);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.error || 'Failed to invite member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
          <p className="mt-1 text-sm text-gray-600">
            Send an invitation to join this workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div>
            <Input
              label="Email Address"
              type="email"
              placeholder="colleague@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('role')}
            >
              <option value="viewer">Viewer - Can view documents and reports</option>
              <option value="member">Member - Can upload and manage documents</option>
              <option value="admin">Admin - Full access except workspace deletion</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          {/* Role Descriptions */}
          <div className="rounded-md bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              <strong>Viewer:</strong> Read-only access to documents and compliance reports.
              <br />
              <strong>Member:</strong> Can upload documents and run compliance checks.
              <br />
              <strong>Admin:</strong> Can manage members and workspace settings.
            </p>
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
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Send Invitation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
