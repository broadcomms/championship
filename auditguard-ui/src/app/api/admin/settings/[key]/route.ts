import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const cookies = request.headers.get('cookie');
  const body = await request.json();

  return proxyToBackend(`/api/admin/settings/${params.key}`, {
    method: 'PUT',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
}
