'use client';

import { useProcessingSteps, ProcessingStep } from '@/hooks/useProcessingSteps';
import { useEffect } from 'react';

interface ProcessingStepsIndicatorProps {
  workspaceId: string;
  documentId: string;
  autoStart?: boolean;
  showProgress?: boolean; // Show overall progress percentage
  compact?: boolean; // Compact mode for small spaces
  onComplete?: () => void; // Callback when all steps complete
}

const STEP_LABELS: Record<string, string> = {
  extraction: 'Text Extraction',
  chunking: 'Document Chunking',
  embedding: 'Vector Embeddings',
  indexing: 'Vector Indexing',
  enrichment: 'AI Enrichment',
};

/**
 * Processing Steps Indicator Component
 *
 * Displays sequential processing steps with real-time status updates.
 * Automatically polls for updates until all steps are complete.
 */
export function ProcessingStepsIndicator({
  workspaceId,
  documentId,
  autoStart = false,
  showProgress = true,
  compact = false,
  onComplete,
}: ProcessingStepsIndicatorProps) {
  const { steps, isPolling, error, isComplete } = useProcessingSteps(
    workspaceId,
    documentId,
    { autoStart }
  );

  // Call onComplete callback when processing finishes
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // Calculate overall progress percentage
  const calculateProgress = (): number => {
    if (steps.length === 0) return 0;

    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-3">
        <p className="text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (steps.length === 0 && !isPolling) {
    return null;
  }

  const progress = calculateProgress();

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {/* Overall Progress Bar */}
      {showProgress && !compact && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              {isComplete ? 'Processing Complete' : 'Processing...'}
            </span>
            <span className="font-semibold text-gray-600">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                isComplete ? 'bg-green-600' : 'bg-blue-600'
              }`}
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Processing Steps List */}
      <div className={`space-y-${compact ? '1.5' : '2.5'}`}>
        {steps.map((step) => (
          <ProcessingStepRow
            key={step.id}
            step={step}
            compact={compact}
          />
        ))}
      </div>

      {/* Completed Summary */}
      {isComplete && !compact && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 mt-3">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-semibold text-green-900">
              Document ready for search and analysis
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Component: Processing Step Row
// ============================================================================

interface ProcessingStepRowProps {
  step: ProcessingStep;
  compact?: boolean;
}

function ProcessingStepRow({ step, compact }: ProcessingStepRowProps) {
  const getIcon = () => {
    if (step.status === 'completed') {
      return (
        <svg
          className="h-5 w-5 text-green-600"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    if (step.status === 'processing') {
      return (
        <svg
          className="h-5 w-5 text-blue-600 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    }

    if (step.status === 'failed') {
      return (
        <svg
          className="h-5 w-5 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    // Pending status
    return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
  };

  const getLabel = () => {
    const baseLabel = STEP_LABELS[step.stepName] || step.stepName;

    // Show progress for embedding step
    if (
      step.status === 'processing' &&
      step.progressTotal &&
      step.progressCurrent !== undefined
    ) {
      return `${baseLabel} (${step.progressCurrent}/${step.progressTotal})`;
    }

    return baseLabel;
  };

  const getDetail = () => {
    if (!step.metadata) return null;

    const details: string[] = [];

    if (step.metadata.wordCount) {
      details.push(`${step.metadata.wordCount.toLocaleString()} words`);
    }

    if (step.metadata.pageCount) {
      details.push(`${step.metadata.pageCount} pages`);
    }

    if (step.metadata.chunkCount) {
      details.push(`${step.metadata.chunkCount} chunks`);
    }

    if (step.metadata.embeddingsGenerated) {
      details.push(`${step.metadata.embeddingsGenerated} embeddings`);
    }

    if (step.metadata.title) {
      details.push(`"${step.metadata.title}"`);
    }

    if (step.metadata.category) {
      details.push(step.metadata.category);
    }

    return details.length > 0 ? details.join(' • ') : null;
  };

  const getLabelColor = () => {
    if (step.status === 'completed') return 'text-green-700 font-semibold';
    if (step.status === 'processing') return 'text-blue-700 font-medium';
    if (step.status === 'failed') return 'text-red-700 font-medium';
    return 'text-gray-500';
  };

  return (
    <div className={`flex items-center gap-${compact ? '2' : '3'}`}>
      {/* Icon */}
      <div className="flex-shrink-0">{getIcon()}</div>

      {/* Label and Details */}
      <div className="flex-1 min-w-0">
        <div className={`text-${compact ? 'xs' : 'sm'} ${getLabelColor()}`}>
          {getLabel()}
        </div>
        {!compact && getDetail() && (
          <div className="text-xs text-gray-600 mt-0.5">{getDetail()}</div>
        )}
        {step.status === 'failed' && step.errorMessage && (
          <div className="text-xs text-red-600 mt-0.5">
            Error: {step.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
