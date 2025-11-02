import { useState } from 'react';
import { api } from '@/lib/api';
import { Document, DocumentCategory } from '@/types';

interface UploadOptions {
  file: File;
  category?: DocumentCategory;
  filename?: string;
  frameworkId?: number; // Phase 5: Compliance framework selection
}

interface UseDocumentUploadReturn {
  upload: (options: UploadOptions) => Promise<Document | null>;
  isUploading: boolean;
  progress: number;
  error: string;
}

export function useDocumentUpload(workspaceId: string): UseDocumentUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const upload = async ({ file, category, filename, frameworkId }: UploadOptions): Promise<Document | null> => {
    setIsUploading(true);
    setProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (filename) {
        formData.append('filename', filename);
      }

      if (category) {
        formData.append('category', category);
      }

      // Phase 5: Include framework ID
      if (frameworkId) {
        formData.append('frameworkId', String(frameworkId));
      }

      // Note: For progress tracking, we would need XMLHttpRequest or a library
      // that supports progress events. For now, we'll just simulate progress.
      setProgress(50);

      const metadata: Record<string, string> = {};
      if (filename) metadata.filename = filename;
      if (category) metadata.category = category;
      if (frameworkId) metadata.frameworkId = String(frameworkId); // Phase 5

      const document = await api.uploadFile(
        `/api/workspaces/${workspaceId}/documents`,
        file,
        metadata
      );

      setProgress(100);
      setIsUploading(false);
      return document;
    } catch (err: any) {
      setError(err.error || 'Failed to upload document');
      setIsUploading(false);
      setProgress(0);
      return null;
    }
  };

  return {
    upload,
    isUploading,
    progress,
    error,
  };
}
