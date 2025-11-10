import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; documentId: string } }
) {
  const cookies = request.headers.get('cookie');
  const { workspaceId, documentId } = params;
  const { searchParams } = new URL(request.url);

  const query = searchParams.toString();
  const path = `/api/workspaces/${workspaceId}/documents/${documentId}/issues` + (query ? `?${query}` : '');

  return proxyToBackend(path, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}
