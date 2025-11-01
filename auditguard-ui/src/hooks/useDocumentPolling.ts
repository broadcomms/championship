import { useState, useEffect, useRef } from 'react';
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

export function useDocumentPolling(
  workspaceId: string,
  documentId: string
): UseDocumentPollingReturn {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = async () => {
    try {
      const doc = await api.get<Document>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`
      );
      setDocument(doc);
      setStatus(doc.processingStatus);

      // Stop polling if processing is complete or failed
      if (doc.processingStatus === 'completed' || doc.processingStatus === 'failed') {
        stopPolling();
      }
    } catch (err: any) {
      setError(err.error || 'Failed to fetch document status');
      stopPolling();
    }
  };

  const startPolling = () => {
    if (intervalRef.current) return; // Already polling

    setIsPolling(true);
    fetchStatus(); // Fetch immediately

    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  };

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
