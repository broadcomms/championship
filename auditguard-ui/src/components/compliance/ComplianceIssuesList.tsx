'use client';

import React, { useEffect, useState } from 'react';
import { ComplianceIssue, IssueSeverity, IssueStatus } from '@/types/compliance';
import { ComplianceFramework } from '@/types';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Filter,
  Search,
  ChevronDown,
  User,
  Calendar
} from 'lucide-react';

interface ComplianceIssuesListProps {
  workspaceId: string;
  onIssueClick: (issueId: string) => void;
  onBulkAction?: (issueIds: string[], action: string) => void;
}

export function ComplianceIssuesList({ 
  workspaceId, 
  onIssueClick,
  onBulkAction 
}: ComplianceIssuesListProps) {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState<ComplianceFramework | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Selection
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchIssues();
  }, [workspaceId]);

  const fetchIssues = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/issues`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch issues');
      }

      const data = await response.json();
      setIssues(data.issues || []);
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: IssueSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityBadge = (severity: IssueSeverity) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200',
      info: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return styles[severity] || styles.info;
  };

  const getStatusIcon = (status: IssueStatus) => {
    switch (status) {
      case 'open':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: IssueStatus) => {
    const styles = {
      open: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-500',
    };
    return styles[status];
  };

  const filteredIssues = issues.filter(issue => {
    // Search filter
    if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !issue.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Framework filter (we'll need to get this from the check)
    // if (frameworkFilter !== 'all' && issue.framework !== frameworkFilter) {
    //   return false;
    // }
    
    // Severity filter
    if (severityFilter !== 'all' && issue.severity !== severityFilter) {
      return false;
    }
    
    // Status filter
    if (statusFilter !== 'all' && issue.status !== statusFilter) {
      return false;
    }
    
    return true;
  });

  const handleSelectAll = () => {
    if (selectedIssues.size === filteredIssues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(filteredIssues.map(i => i.id)));
    }
  };

  const handleSelectIssue = (issueId: string) => {
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId);
    } else {
      newSelected.add(issueId);
    }
    setSelectedIssues(newSelected);
  };

  const handleBulkStatusChange = (newStatus: IssueStatus) => {
    if (onBulkAction && selectedIssues.size > 0) {
      onBulkAction(Array.from(selectedIssues), `change_status:${newStatus}`);
      setSelectedIssues(new Set());
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading compliance issues...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle className="w-6 h-6" />
          <h3 className="text-lg font-semibold">Error Loading Issues</h3>
        </div>
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchIssues}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            {/* Framework Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Framework</label>
              <select
                value={frameworkFilter}
                onChange={(e) => setFrameworkFilter(e.target.value as ComplianceFramework | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Frameworks</option>
                <option value="GDPR">GDPR</option>
                <option value="HIPAA">HIPAA</option>
                <option value="SOC2">SOC 2</option>
                <option value="ISO27001">ISO 27001</option>
                <option value="PCI-DSS">PCI-DSS</option>
                <option value="CCPA">CCPA</option>
                <option value="NIST">NIST</option>
              </select>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIssues.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedIssues.size} issue{selectedIssues.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatusChange('in_progress')}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Mark In Progress
              </button>
              <button
                onClick={() => handleBulkStatusChange('resolved')}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Mark Resolved
              </button>
              <button
                onClick={() => handleBulkStatusChange('dismissed')}
                className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Issues Count */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {filteredIssues.length} Issue{filteredIssues.length !== 1 ? 's' : ''}
        </h3>
        {filteredIssues.length > 0 && (
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {selectedIssues.size === filteredIssues.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Issues Found</h3>
          <p className="text-gray-600">
            {searchQuery || severityFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'All compliance checks are passing!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIssues.has(issue.id)}
                    onChange={() => handleSelectIssue(issue.id)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />

                  {/* Severity Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(issue.severity)}
                  </div>

                  {/* Issue Content */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onIssueClick(issue.id)}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="text-base font-semibold text-gray-900 hover:text-blue-600">
                        {issue.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSeverityBadge(issue.severity)}`}>
                          {issue.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusBadge(issue.status)}`}>
                          {getStatusIcon(issue.status)}
                          {issue.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {issue.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(issue.createdAt).toLocaleDateString()}
                      </span>
                      {issue.assignedTo && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Assigned
                        </span>
                      )}
                      {issue.category && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded">
                          {issue.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
