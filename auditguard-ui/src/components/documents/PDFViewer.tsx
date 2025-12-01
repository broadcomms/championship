'use client';

import React, { useState, useEffect } from 'react';

interface PDFViewerProps {
  workspaceId: string;
  documentId: string;
}

export function PDFViewer({ workspaceId, documentId }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchPdfUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/workspaces/${workspaceId}/documents/${documentId}/download`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();

    // Cleanup function to revoke object URL
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [workspaceId, documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">No PDF available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* PDF Viewer using iframe with native browser PDF viewer */}
      <iframe
        src={pdfUrl}
        className="w-full h-full min-h-[600px] border-0"
        title="PDF Document Viewer"
      />
    </div>
  );
}
