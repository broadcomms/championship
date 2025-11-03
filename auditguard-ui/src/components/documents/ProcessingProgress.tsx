'use client';

import { ProcessingStatus } from '@/types';

interface ProcessingProgressProps {
  processingStatus: ProcessingStatus;
  textExtracted?: boolean;
  chunkCount?: number;
  embeddingsGenerated?: number;
  vectorIndexingStatus?: string;
  pageCount?: number;
  wordCount?: number;
}

export function ProcessingProgress({
  processingStatus,
  textExtracted,
  chunkCount = 0,
  embeddingsGenerated = 0,
  vectorIndexingStatus,
  pageCount,
  wordCount,
}: ProcessingProgressProps) {
  // Calculate progress based on local processing only
  const getProgress = (): number => {
    if (processingStatus === 'completed') return 100;
    if (processingStatus === 'failed') return 0;

    let progress = 0;

    // Text extraction: 40%
    if (textExtracted) progress += 40;

    // Chunking: 20%
    if (chunkCount > 0) progress += 20;

    // Vector embeddings: 40%
    if (vectorIndexingStatus === 'completed') {
      progress += 40;
    } else if (vectorIndexingStatus === 'processing' && embeddingsGenerated > 0 && chunkCount > 0) {
      const ratio = embeddingsGenerated / chunkCount;
      progress += Math.round(40 * ratio);
    }

    return Math.min(progress, 99); // Cap at 99% until truly completed
  };

  const progress = getProgress();

  const getStatusText = (): string => {
    if (processingStatus === 'completed') return 'Processing complete';
    if (processingStatus === 'failed') return 'Processing failed';
    if (processingStatus === 'pending') return 'Queued for processing';

    // Specific status messages
    if (!textExtracted) return 'Extracting text from document...';
    if (chunkCount === 0) return 'Creating semantic chunks...';
    if (vectorIndexingStatus === 'processing') {
      if (embeddingsGenerated > 0 && chunkCount > 0) {
        return `Generating embeddings (${embeddingsGenerated}/${chunkCount})...`;
      }
      return 'Generating vector embeddings...';
    }
    if (vectorIndexingStatus === 'completed') return 'Finalizing...';

    return 'Processing document...';
  };

  const getProgressColor = (): string => {
    if (processingStatus === 'failed') return 'bg-red-600';
    if (processingStatus === 'completed') return 'bg-green-600';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
          <span className="text-sm font-semibold text-gray-600">{progress}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Processing Steps */}
      {processingStatus === 'processing' && (
        <div className="space-y-2.5 border-t border-gray-200 pt-4">
          <ProcessingStep
            completed={textExtracted || false}
            label="Text Extraction"
            detail={textExtracted && wordCount ? 
              `${wordCount.toLocaleString()} words${pageCount ? `, ${pageCount} pages` : ''}` : 
              undefined
            }
          />
          
          <ProcessingStep
            completed={chunkCount > 0}
            label="Document Chunking"
            detail={chunkCount > 0 ? `${chunkCount} chunks` : undefined}
          />
          
          <ProcessingStep
            completed={vectorIndexingStatus === 'completed'}
            processing={vectorIndexingStatus === 'processing'}
            label="Vector Embeddings"
            detail={embeddingsGenerated > 0 && chunkCount > 0 ? 
              `${embeddingsGenerated}/${chunkCount}` : 
              undefined
            }
          />
          
          {textExtracted && (
            <ProcessingStep
              processing={true}
              label="SmartBucket Indexing"
              detail="in background"
              isBackground
            />
          )}
        </div>
      )}

      {/* Completed Summary */}
      {processingStatus === 'completed' && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-green-900 mb-1">
                Document ready for search
              </div>
              <div className="text-xs text-green-700">
                {chunkCount} chunks • {embeddingsGenerated} embeddings
                {wordCount && ` • ${wordCount.toLocaleString()} words`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed State */}
      {processingStatus === 'failed' && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-red-900 mb-1">Processing failed</div>
              <div className="text-xs text-red-700">Please try reprocessing the document</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Component: Processing Step
// ============================================================================

interface ProcessingStepProps {
  completed?: boolean;
  processing?: boolean;
  label: string;
  detail?: string;
  isBackground?: boolean;
}

function ProcessingStep({ 
  completed = false, 
  processing = false, 
  label, 
  detail,
  isBackground = false
}: ProcessingStepProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <div className="flex-shrink-0">
        {completed ? (
          <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : processing ? (
          <svg className="h-5 w-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300"></div>
        )}
      </div>
      
      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${
          completed ? 'font-semibold text-green-700' :
          processing && !isBackground ? 'font-medium text-blue-700' :
          isBackground ? 'font-medium text-gray-600' :
          'text-gray-500'
        }`}>
          {label}
        </div>
        {detail && (
          <div className={`text-xs mt-0.5 ${
            isBackground ? 'text-gray-500 italic' : 'text-gray-600'
          }`}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
