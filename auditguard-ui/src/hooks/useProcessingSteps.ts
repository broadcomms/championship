import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

export interface ProcessingStep {
  id: string;
  documentId: string;
  stepName: string;
  stepOrder: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  progressCurrent?: number;
  progressTotal?: number;
  metadata?: any;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

interface UseProcessingStepsOptions {
  autoStart?: boolean;
  pollInterval?: number; // milliseconds
  maxPollDuration?: number; // milliseconds
}

interface UseProcessingStepsReturn {
  steps: ProcessingStep[];
  isPolling: boolean;
  error: string;
  startPolling: () => void;
  stopPolling: () => void;
  fetchSteps: () => Promise<void>;
  isComplete: boolean;
}

const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds
const DEFAULT_MAX_POLL_DURATION = 600000; // 10 minutes

/**
 * Hook for fetching and polling document processing steps
 *
 * @param workspaceId - The workspace ID
 * @param documentId - The document ID
 * @param options - Configuration options
 * @returns Processing steps data and control functions
 */
export function useProcessingSteps(
  workspaceId: string,
  documentId: string,
  options: UseProcessingStepsOptions = {}
): UseProcessingStepsReturn {
  const {
    autoStart = false,
    pollInterval = DEFAULT_POLL_INTERVAL,
    maxPollDuration = DEFAULT_MAX_POLL_DURATION,
  } = options;

  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTime = useRef<number>(0);

  /**
   * Fetch processing steps from API
   */
  const fetchSteps = useCallback(async () => {
    if (!workspaceId || !documentId) {
      return;
    }

    try {
      const response = await api.get<{ steps: ProcessingStep[] }>(
        `/api/workspaces/${workspaceId}/documents/${documentId}/processing-steps`
      );

      setSteps(response.steps || []);
      setError('');

      // Check if all steps are completed
      const allComplete =
        response.steps.length > 0 &&
        response.steps.every((step) => step.status === 'completed');

      setIsComplete(allComplete);

      // Stop polling if all steps completed or any step failed
      if (allComplete || response.steps.some((step) => step.status === 'failed')) {
        stopPolling();
      }

      // Safety check: Stop if polling for too long
      if (isPolling) {
        const elapsed = Date.now() - pollingStartTime.current;
        if (elapsed > maxPollDuration) {
          console.warn(`Polling exceeded ${maxPollDuration}ms, stopping`);
          stopPolling();
        }
      }
    } catch (err: any) {
      setError(err.error || 'Failed to fetch processing steps');
      setSteps([]);
      // Don't stop polling on error - might be temporary
    }
  }, [workspaceId, documentId, maxPollDuration, isPolling]);

  /**
   * Start polling for processing steps
   */
  const startPolling = useCallback(() => {
    // Stop existing polling first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsPolling(true);
    pollingStartTime.current = Date.now();

    // Fetch immediately
    fetchSteps();

    // Then poll at interval
    intervalRef.current = setInterval(() => {
      fetchSteps();
    }, pollInterval);
  }, [fetchSteps, pollInterval]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart && workspaceId && documentId) {
      startPolling();
    }
  }, [autoStart, workspaceId, documentId, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    steps,
    isPolling,
    error,
    startPolling,
    stopPolling,
    fetchSteps,
    isComplete,
  };
}
