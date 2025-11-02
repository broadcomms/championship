'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/common/Button';
import { DocumentCategory, ComplianceFrameworkInfo } from '@/types';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { api } from '@/lib/api';

interface DocumentUploadProps {
  workspaceId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'other', label: 'Other' },
];

export function DocumentUpload({ workspaceId, onSuccess, onClose }: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [filename, setFilename] = useState('');
  const [frameworkId, setFrameworkId] = useState<number | undefined>(undefined);
  const [frameworks, setFrameworks] = useState<ComplianceFrameworkInfo[]>([]);
  const [loadingFrameworks, setLoadingFrameworks] = useState(true);

  const { upload, isUploading, progress, error } = useDocumentUpload(workspaceId);

  // Phase 5: Load available compliance frameworks
  useEffect(() => {
    const fetchFrameworks = async () => {
      try {
        const data = await api.get<ComplianceFrameworkInfo[]>(
          `/api/workspaces/${workspaceId}/frameworks`
        );
        setFrameworks(data);
      } catch (err) {
        console.error('Failed to load frameworks:', err);
      } finally {
        setLoadingFrameworks(false);
      }
    };

    fetchFrameworks();
  }, [workspaceId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        setFilename(file.name);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    const document = await upload({
      file: selectedFile,
      category,
      filename: filename || selectedFile.name,
      frameworkId, // Phase 5: Include selected framework
    });

    if (document) {
      setSelectedFile(null);
      setFilename('');
      setFrameworkId(undefined);
      onSuccess?.();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      {!selectedFile && (
        <div
          {...getRootProps()}
          className={`
            cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-4xl mb-4">📄</div>
          {isDragActive ? (
            <p className="text-lg text-blue-600">Drop the file here...</p>
          ) : (
            <div>
              <p className="text-lg text-gray-900 mb-2">
                Drag and drop a document here
              </p>
              <p className="text-sm text-gray-600 mb-4">
                or click to select a file
              </p>
              <p className="text-xs text-gray-500">
                Supported: PDF, DOCX, TXT, MD (max 100MB)
              </p>
            </div>
          )}
        </div>
      )}

      {/* File Preview */}
      {selectedFile && !isUploading && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">📄</div>
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>

            {/* Filename Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Name
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter document name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category Selector */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phase 5: Compliance Framework Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Compliance Framework (Optional)
                {loadingFrameworks && <span className="ml-2 text-xs text-gray-500">Loading...</span>}
              </label>
              <select
                value={frameworkId || ''}
                onChange={(e) => setFrameworkId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={loadingFrameworks}
              >
                <option value="">None (general document)</option>
                {frameworks
                  .filter((fw) => fw.isActive)
                  .map((framework) => (
                    <option key={framework.id} value={framework.id}>
                      {framework.displayName}
                    </option>
                  ))}
              </select>
              {frameworkId && (
                <p className="mt-1 text-xs text-gray-600">
                  Document chunks will be auto-tagged with {frameworks.find(f => f.id === frameworkId)?.displayName} relevance scores
                </p>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile}
            >
              Upload Document
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Uploading...</span>
              <span className="text-gray-600">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Your document is being uploaded and will be processed automatically.
          </p>
        </div>
      )}
    </div>
  );
}
