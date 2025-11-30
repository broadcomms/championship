import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { DocumentListItem } from '@/types';

interface UseDocumentsReturn {
  documents: DocumentListItem[];
  isLoading: boolean;
  error: string;
  refetch: () => Promise<void>;
  isPolling: boolean;
}

const POLL_INTERVAL = 3000; // Poll every 3 seconds
const MAX_POLL_DURATION = 300000; // Stop after 5 minutes

export function useDocuments(workspaceId: string): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number>(0);

  const fetchDocuments = useCallback(async () => {
    setError('');
    try {
      const response = await api.get<{ documents: DocumentListItem[] }>(
        `/api/workspaces/${workspaceId}/documents`
      );
      setDocuments(response.documents || []);

      // Check if any documents are still processing
      const hasProcessingDocs = response.documents?.some(
        (doc) => doc.processingStatus === 'pending' || doc.processingStatus === 'processing'
      );

      return hasProcessingDocs;
    } catch (err: unknown) {
      const rawMessage =
        (typeof err === 'object' && err && 'error' in err && typeof (err as { error?: string }).error === 'string'
          ? (err as { error?: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to load documents');
      const safeMessage = rawMessage && rawMessage.trim().length > 0 ? rawMessage : 'Failed to load documents';
      setError(safeMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(async () => {
    if (intervalRef.current) return; // Already polling

    setIsPolling(true);
    pollingStartTimeRef.current = Date.now();

    // Fetch immediately
    const hasProcessingDocs = await fetchDocuments();

    if (!hasProcessingDocs) {
      setIsPolling(false);
      return;
    }

    intervalRef.current = setInterval(async () => {
      const hasProcessingDocs = await fetchDocuments();

      // Stop polling if no more processing docs or timeout exceeded
      const elapsedTime = Date.now() - pollingStartTimeRef.current;
      if (!hasProcessingDocs || elapsedTime > MAX_POLL_DURATION) {
        stopPolling();
      }
    }, POLL_INTERVAL);
  }, [fetchDocuments, stopPolling]);

  // Initial fetch and auto-start polling
  useEffect(() => {
    if (workspaceId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling, workspaceId]);

  return {
    documents,
    isLoading,
    error,
    refetch: startPolling, // Refetch also restarts polling
    isPolling,
  };
}
