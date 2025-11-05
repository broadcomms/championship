import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  const cookies = request.headers.get('cookie');
  const { searchParams } = new URL(request.url);

  // Forward query parameters (limit, offset)
  const params = new URLSearchParams();
  if (searchParams.get('limit')) params.set('limit', searchParams.get('limit')!);
  if (searchParams.get('offset')) params.set('offset', searchParams.get('offset')!);

  const queryString = params.toString();
  const path = `/api/admin/users${queryString ? `?${queryString}` : ''}`;

  return proxyToBackend(path, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}
