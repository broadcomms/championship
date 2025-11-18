import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; checkId: string } }
) {
  const cookies = request.headers.get('cookie');
  const { workspaceId, checkId } = params;

  return proxyToBackend(`/api/workspaces/${workspaceId}/compliance/${checkId}`, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}