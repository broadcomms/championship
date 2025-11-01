/**
 * Detect content type from filename extension
 * Handles cases where the browser sends "application/octet-stream" for text files
 */
export function detectContentType(filename: string, providedContentType?: string): string {
  // If a valid specific content type is provided, use it
  if (providedContentType && providedContentType !== 'application/octet-stream') {
    return providedContentType;
  }

  // Extract file extension
  const extension = filename.toLowerCase().split('.').pop();

  // Map extensions to content types
  const contentTypeMap: Record<string, string> = {
    // Text files
    'txt': 'text/plain',
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'csv': 'text/csv',
    'log': 'text/plain',

    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Code files
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'py': 'text/x-python',
    'java': 'text/x-java',
    'c': 'text/x-c',
    'cpp': 'text/x-c++',
    'h': 'text/x-c',
    'hpp': 'text/x-c++',
    'sh': 'text/x-shellscript',
    'bash': 'text/x-shellscript',

    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',

    // Archives
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    '7z': 'application/x-7z-compressed',
  };

  const detectedType = extension ? contentTypeMap[extension] : undefined;

  // Return detected type or fallback to provided type or default
  return detectedType || providedContentType || 'application/octet-stream';
}
