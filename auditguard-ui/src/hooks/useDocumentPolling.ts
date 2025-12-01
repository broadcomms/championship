import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { ProcessingStatus, Document } from '@/types';

interface UseDocumentPollingReturn {
  status: ProcessingStatus | null;
  document: Document | null;
  isPolling: boolean;
  error: string;
  startPolling: () => void;
  stopPolling: () => void;
}

const POLL_INTERVAL = 2000; // Poll every 2 seconds
const MAX_POLL_DURATION = 600000; // Stop after 10 minutes (safety limit)

/**
 * useDocumentPolling Hook
 *
 * Polls document status until fully_completed flag is set.
 * This ensures we don't stop polling before AI enrichment completes.
 *
 * CRITICAL FIX: Previously stopped when processingStatus='completed',
 * but AI enrichment happens AFTER that. Now polls until fullyCompleted=true.
 *
 * @param workspaceId - Workspace ID
 * @param documentId - Document ID to poll
 * @returns Document data, polling state, and control functions
 */
export function useDocumentPolling(
  workspaceId: string,
  documentId: string
): UseDocumentPollingReturn {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTime = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  /**
   * Fetch current document status
   * Returns true if should continue polling
   */
  const fetchStatus = useCallback(async (): Promise<boolean> => {
    try {
      const doc = await api.get<Document>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`
      );

      setDocument(doc);
      setStatus(doc.processingStatus);

      // CRITICAL FIX: Stop polling only when FULLY completed (including enrichment)
      // Or when processing failed
      const shouldContinuePolling =
        !doc.fullyCompleted &&
        doc.processingStatus !== 'failed';

      if (!shouldContinuePolling) {
        stopPolling();
      }

      // Safety check: Stop if polling for too long
      const elapsed = Date.now() - pollingStartTime.current;
      if (elapsed > MAX_POLL_DURATION) {
        console.warn(`Polling exceeded ${MAX_POLL_DURATION}ms, stopping`);
        stopPolling();
        return false;
      }
      return shouldContinuePolling;
    } catch (err: unknown) {
      const rawMessage =
        (typeof err === 'object' && err && 'error' in err && typeof (err as { error?: string }).error === 'string'
          ? (err as { error?: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to fetch document status');
      const safeMessage = rawMessage && rawMessage.trim().length > 0 ? rawMessage : 'Failed to fetch document status';
      setError(safeMessage);
      stopPolling();
      return false;
    }
  }, [workspaceId, documentId, stopPolling]);

  const startPolling = useCallback(() => {
    // CRITICAL FIX: Stop existing polling first to allow restart
    // This ensures polling can be restarted after document reprocessing
    if (intervalRef.current) {
      console.log('Restarting polling (was already active)');
      stopPolling();
    }

    setIsPolling(true);
    pollingStartTime.current = Date.now();

    // Fetch immediately
    fetchStatus();

    // Then poll at interval
    intervalRef.current = setInterval(async () => {
      await fetchStatus();
    }, POLL_INTERVAL);
  }, [fetchStatus, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    status,
    document,
    isPolling,
    error,
    startPolling,
    stopPolling,
  };
}
