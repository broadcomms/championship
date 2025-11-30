'use client';

import { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { api } from '@/lib/api';
import { WorkspaceMember, PriorityLevel, PRIORITY_LABELS } from '@/types/compliance';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  issueId: string;
  currentAssignee?: string | null;
  currentDueDate?: string | null;
  currentPriority?: PriorityLevel | null;
  onAssigned: () => void;
}

export function AssignmentModal({
  isOpen,
  onClose,
  workspaceId,
  issueId,
  currentAssignee,
  currentDueDate,
  currentPriority,
  onAssigned,
}: AssignmentModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(
    currentDueDate ? new Date(currentDueDate) : null
  );
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>(
    currentPriority || 'P3'
  );
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSelectedMember(null);
      setSearchTerm('');
      setMembers([]);
      setDueDate(currentDueDate ? new Date(currentDueDate) : null);
      setPriorityLevel(currentPriority || 'P3');
      // Don't auto-search, wait for user input
    }
  }, [isOpen, currentDueDate, currentPriority]);

  const searchMembers = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const response = await api.get<{ members: WorkspaceMember[] }>(
        `/api/workspaces/${workspaceId}/members/search?q=${encodeURIComponent(query)}&limit=20`
      );
      setMembers(response.members || []);
      // Clear selection when new search results arrive
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to search members:', error);
      setMembers([]);
      setSelectedMember(null);
    } finally {
      setSearching(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim()) {
        searchMembers(searchTerm);
      } else {
        // Clear members when search is empty
        setMembers([]);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchMembers, searchTerm]);

  const handleAssign = async () => {
    if (!selectedMember) {
      alert('Please select a team member');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/issues/${issueId}/assign-with-details`,
        {
          assignedToUserId: selectedMember.userId,
          dueDate: dueDate ? dueDate.toISOString() : undefined,
          priorityLevel,
        }
      );
      onAssigned();
      onClose();
    } catch (error) {
      console.error('Failed to assign issue:', error);
      alert('Failed to assign issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Assign Issue</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Member Search */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign to
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search team members..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Members List */}
          <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-2">
            {searching ? (
              <div className="text-center py-4 text-gray-500">Searching...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                {searchTerm.trim() ? 'No members found' : 'Start typing to search members...'}
              </div>
            ) : (
              members.map((member) => {
                const isSelected = selectedMember?.userId === member.userId;
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      // Toggle selection - if already selected, deselect; otherwise select
                      if (isSelected) {
                        setSelectedMember(null);
                      } else {
                        setSelectedMember(member);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {member.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {member.name || member.email}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    </div>
                    {isSelected && (
                      <span className="text-blue-600 text-xl font-bold">✓</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Due Date */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date (Optional)
          </label>
          <DatePicker
            selected={dueDate}
            onChange={(date) => setDueDate(date)}
            minDate={new Date()}
            dateFormat="MMMM d, yyyy"
            placeholderText="Select due date..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Priority Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['P1', 'P2', 'P3', 'P4'] as PriorityLevel[]).map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setPriorityLevel(priority);
                }}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition ${
                  priorityLevel === priority
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {PRIORITY_LABELS[priority]}
              </button>
            ))}
          </div>
        </div>

        {/* Current Assignment Info */}
        {currentAssignee && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
            <p className="text-yellow-800">
              <span className="font-medium">Current assignee:</span> {currentAssignee}
            </p>
            {currentDueDate && (
              <p className="text-yellow-700 mt-1">
                <span className="font-medium">Current due date:</span>{' '}
                {new Date(currentDueDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedMember || submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitting ? 'Assigning...' : currentAssignee ? 'Reassign' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
