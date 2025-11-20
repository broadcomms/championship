'use client';

import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  BarChart3,
  Download,
  Shield,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';

interface Suggestion {
  id: string;
  text: string;
  category?: 'compliance' | 'documents' | 'analytics' | 'help' | 'action';
  icon?: string;
  context?: string;
}

interface SuggestionChipsProps {
  suggestions: Suggestion[] | string[];
  onSelect: (suggestion: string | Suggestion) => void;
  maxVisible?: number;
  showCategories?: boolean;
}

const categoryConfig = {
  compliance: {
    icon: Shield,
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  documents: {
    icon: FileText,
    color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  },
  analytics: {
    icon: BarChart3,
    color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  },
  help: {
    icon: HelpCircle,
    color: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  },
  action: {
    icon: Lightbulb,
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  },
};

export function SuggestionChips({
  suggestions,
  onSelect,
  maxVisible = 6,
  showCategories = false,
}: SuggestionChipsProps) {
  const [showAll, setShowAll] = useState(false);

  // Normalize suggestions to array of Suggestion objects
  const normalizedSuggestions: Suggestion[] = suggestions.map((s, index) => {
    if (typeof s === 'string') {
      return {
        id: `suggestion-${index}`,
        text: s,
        category: inferCategory(s),
      };
    }
    return s;
  });

  const visibleSuggestions = showAll
    ? normalizedSuggestions
    : normalizedSuggestions.slice(0, maxVisible);

  const hasMore = normalizedSuggestions.length > maxVisible;

  function inferCategory(text: string): Suggestion['category'] {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes('compliance') ||
      lowerText.includes('gdpr') ||
      lowerText.includes('hipaa') ||
      lowerText.includes('soc') ||
      lowerText.includes('iso')
    ) {
      return 'compliance';
    }

    if (
      lowerText.includes('document') ||
      lowerText.includes('file') ||
      lowerText.includes('upload')
    ) {
      return 'documents';
    }

    if (
      lowerText.includes('analytics') ||
      lowerText.includes('report') ||
      lowerText.includes('score') ||
      lowerText.includes('metrics')
    ) {
      return 'analytics';
    }

    if (
      lowerText.includes('how') ||
      lowerText.includes('what') ||
      lowerText.includes('why') ||
      lowerText.includes('explain')
    ) {
      return 'help';
    }

    return 'action';
  }

  function getIcon(suggestion: Suggestion) {
    if (suggestion.icon) {
      return <span className="mr-1.5">{suggestion.icon}</span>;
    }

    if (suggestion.category && showCategories) {
      const Icon = categoryConfig[suggestion.category].icon;
      return <Icon className="w-3.5 h-3.5 mr-1.5" />;
    }

    return null;
  }

  function getColorClass(suggestion: Suggestion) {
    if (suggestion.category && showCategories) {
      return categoryConfig[suggestion.category].color;
    }
    return 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100';
  }

  if (normalizedSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">
          💡 Suggested questions:
        </p>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAll ? 'Show less' : `Show all (${normalizedSuggestions.length})`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleSuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion)}
            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium border transition-all hover:shadow-sm ${getColorClass(
              suggestion
            )}`}
            title={suggestion.context}
          >
            {getIcon(suggestion)}
            <span>{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Context-aware suggestion generator
 */
export function generateSuggestions(
  context: {
    currentTopic?: string;
    recentMessages?: string[];
    workspaceData?: {
      documentCount?: number;
      issueCount?: number;
      frameworks?: string[];
    };
  }
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Always include these general suggestions
  const general: Suggestion[] = [
    {
      id: 'compliance-score',
      text: 'What is my compliance score?',
      category: 'analytics',
      context: 'View your overall compliance status across all frameworks',
    },
    {
      id: 'critical-issues',
      text: 'Show me critical issues',
      category: 'compliance',
      context: 'View all high-priority compliance issues that need attention',
    },
    {
      id: 'recent-changes',
      text: 'What changed recently?',
      category: 'documents',
      context: 'Review recent updates to your compliance documents',
    },
  ];

  suggestions.push(...general);

  // Context-aware suggestions based on workspace data
  if (context.workspaceData?.frameworks) {
    context.workspaceData.frameworks.forEach((framework) => {
      suggestions.push({
        id: `framework-${framework.toLowerCase()}`,
        text: `Check ${framework} compliance`,
        category: 'compliance',
        context: `View compliance status for ${framework} framework`,
      });
    });
  }

  // Suggestions based on issue count
  if (context.workspaceData?.issueCount && context.workspaceData.issueCount > 0) {
    suggestions.push({
      id: 'resolve-issues',
      text: 'How do I resolve these issues?',
      category: 'help',
      context: 'Get guidance on resolving compliance issues',
    });
  }

  // Topic-based follow-ups
  if (context.currentTopic) {
    const topic = context.currentTopic.toLowerCase();

    if (topic.includes('gdpr')) {
      suggestions.push(
        {
          id: 'gdpr-breach',
          text: 'What are GDPR breach notification rules?',
          category: 'compliance',
        },
        {
          id: 'gdpr-rights',
          text: 'Explain GDPR user rights',
          category: 'help',
        }
      );
    }

    if (topic.includes('soc') || topic.includes('soc2')) {
      suggestions.push(
        {
          id: 'soc2-controls',
          text: 'What controls does SOC 2 require?',
          category: 'compliance',
        },
        {
          id: 'soc2-audit',
          text: 'How to prepare for SOC 2 audit?',
          category: 'action',
        }
      );
    }
  }

  return suggestions.slice(0, 8); // Return max 8 suggestions
}
