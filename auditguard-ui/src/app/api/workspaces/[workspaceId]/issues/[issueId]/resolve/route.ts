import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string; issueId: string } }
) {
  const cookies = request.headers.get('cookie');
  const { workspaceId, issueId } = params;
  const body = await request.text();

  return proxyToBackend(`/api/workspaces/${workspaceId}/issues/${issueId}/resolve`, {
    method: 'POST',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
    body,
  });
}
