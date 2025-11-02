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
  // Calculate overall progress
  const getProgress = (): number => {
    if (processingStatus === 'completed') return 100;
    if (processingStatus === 'failed') return 0;

    let progress = 0;

    // Text extraction: 30%
    if (textExtracted) progress += 30;

    // Chunking: 20%
    if (chunkCount > 0) progress += 20;

    // Embeddings: 30%
    if (vectorIndexingStatus === 'completed') progress += 30;
    else if (vectorIndexingStatus === 'processing' && embeddingsGenerated > 0) {
      // Partial credit based on embeddings generated
      const ratio = embeddingsGenerated / Math.max(chunkCount, 1);
      progress += Math.round(30 * ratio);
    }

    // SmartBucket indexing: 20%
    if (processingStatus === 'processing' && textExtracted) progress += 10;

    return Math.min(progress, 99); // Cap at 99% until truly completed
  };

  const progress = getProgress();

  const getStatusText = (): string => {
    if (processingStatus === 'completed') return 'Processing complete';
    if (processingStatus === 'failed') return 'Processing failed';
    if (processingStatus === 'pending') return 'Queued for processing';

    // processing status - be more specific
    if (!textExtracted) return 'Extracting text...';
    if (chunkCount === 0) return 'Creating chunks...';
    if (vectorIndexingStatus === 'processing') {
      if (embeddingsGenerated > 0 && chunkCount > 0) {
        return `Generating embeddings (${embeddingsGenerated}/${chunkCount})...`;
      }
      return 'Generating embeddings...';
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
    <div className="space-y-3">
      {/* Progress Bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-gray-700">{getStatusText()}</span>
          <span className="text-gray-600">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase Details */}
      {processingStatus === 'processing' && (
        <div className="space-y-2 text-xs text-gray-600">
          {/* Text Extraction */}
          <div className="flex items-center gap-2">
            <span className={textExtracted ? 'text-green-600' : 'text-gray-400'}>
              {textExtracted ? '✓' : '○'}
            </span>
            <span className={textExtracted ? 'text-green-700 font-medium' : ''}>
              Text Extraction
            </span>
            {textExtracted && wordCount && (
              <span className="text-gray-500">
                ({wordCount.toLocaleString()} words{pageCount ? `, ${pageCount} pages` : ''})
              </span>
            )}
          </div>

          {/* Chunking */}
          <div className="flex items-center gap-2">
            <span className={chunkCount > 0 ? 'text-green-600' : 'text-gray-400'}>
              {chunkCount > 0 ? '✓' : '○'}
            </span>
            <span className={chunkCount > 0 ? 'text-green-700 font-medium' : ''}>
              Document Chunking
            </span>
            {chunkCount > 0 && (
              <span className="text-gray-500">
                ({chunkCount} chunks)
              </span>
            )}
          </div>

          {/* Vector Embeddings */}
          <div className="flex items-center gap-2">
            <span className={vectorIndexingStatus === 'completed' ? 'text-green-600' :
                           vectorIndexingStatus === 'processing' ? 'text-blue-600 animate-spin' :
                           'text-gray-400'}>
              {vectorIndexingStatus === 'completed' ? '✓' :
               vectorIndexingStatus === 'processing' ? '⚙' : '○'}
            </span>
            <span className={vectorIndexingStatus === 'completed' ? 'text-green-700 font-medium' : ''}>
              Vector Embeddings
            </span>
            {embeddingsGenerated > 0 && chunkCount > 0 && (
              <span className="text-gray-500">
                ({embeddingsGenerated}/{chunkCount})
              </span>
            )}
          </div>

          {/* SmartBucket Indexing */}
          <div className="flex items-center gap-2">
            <span className="text-blue-600 animate-spin">⚙</span>
            <span>SmartBucket Indexing</span>
            <span className="text-gray-500">(in background)</span>
          </div>
        </div>
      )}

      {/* Completed Summary */}
      {processingStatus === 'completed' && (
        <div className="rounded-md bg-green-50 p-3 text-xs text-green-800">
          <div className="font-medium mb-1">✓ Document ready for search</div>
          <div className="text-green-700">
            {chunkCount} chunks • {embeddingsGenerated} embeddings
            {wordCount && ` • ${wordCount.toLocaleString()} words`}
          </div>
        </div>
      )}

      {/* Failed State */}
      {processingStatus === 'failed' && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-800">
          ✗ Processing failed - please try reprocessing
        </div>
      )}
    </div>
  );
}
