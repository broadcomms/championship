import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; documentId: string } }
) {
  const cookies = request.headers.get('cookie');
  const { workspaceId, documentId } = params;

  return proxyToBackend(`/api/workspaces/${workspaceId}/documents/${documentId}/compliance/summary`, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}
