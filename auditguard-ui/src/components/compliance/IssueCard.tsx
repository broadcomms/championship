'use client';

import React from 'react';
import {
  ComplianceIssue,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/types';

interface IssueCardProps {
  issue: ComplianceIssue;
  onClick?: () => void;
  selected?: boolean;
}

export function IssueCard({ issue, onClick, selected = false }: IssueCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg border-2 p-4 transition-all cursor-pointer
        ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.();
        }
      }}
      aria-pressed={selected}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{issue.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{issue.description}</p>
        </div>

        {/* Severity Badge */}
        <span className={`
          px-2.5 py-1 rounded-full text-xs font-medium border
          ${SEVERITY_COLORS[issue.severity]}
        `}>
          {SEVERITY_LABELS[issue.severity]}
        </span>
      </div>

      {/* Metadata Row */}
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <span className={`
            px-2 py-0.5 rounded border text-xs
            ${STATUS_COLORS[issue.status]}
          `}>
            {STATUS_LABELS[issue.status]}
          </span>

          {/* Category */}
          <span className="text-gray-600">
            {issue.category}
          </span>

          {/* Risk Score */}
          {issue.riskScore !== null && (
            <span className="text-gray-500">
              Risk: {issue.riskScore}/100
            </span>
          )}
        </div>

        {/* Assignment Info */}
        {issue.assignedTo && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">Assigned</span>
          </div>
        )}
      </div>

      {/* Excerpt Preview */}
      {issue.excerpt && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-700 italic line-clamp-2">
            "{issue.excerpt}"
          </p>
        </div>
      )}

      {/* Regulation Citation */}
      {issue.regulationCitation && (
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Regulation:</span> {issue.regulationCitation}
        </div>
      )}
    </div>
  );
}
