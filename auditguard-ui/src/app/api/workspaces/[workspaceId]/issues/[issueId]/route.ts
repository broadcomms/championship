import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; issueId: string } }
) {
  const cookies = request.headers.get('cookie');
  const { workspaceId, issueId } = params;

  return proxyToBackend(`/api/workspaces/${workspaceId}/issues/${issueId}`, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}
