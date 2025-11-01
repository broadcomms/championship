import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DocumentListItem } from '@/types';

interface UseDocumentsReturn {
  documents: DocumentListItem[];
  isLoading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

export function useDocuments(workspaceId: string): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get<{ documents: DocumentListItem[] }>(
        `/api/workspaces/${workspaceId}/documents`
      );
      setDocuments(response.documents || []);
    } catch (err: any) {
      setError(err.error || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchDocuments();
    }
  }, [workspaceId]);

  return {
    documents,
    isLoading,
    error,
    refetch: fetchDocuments,
  };
}
