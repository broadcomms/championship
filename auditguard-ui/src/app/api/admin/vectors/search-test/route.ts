import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function POST(request: NextRequest) {
  const cookies = request.headers.get('cookie');
  const body = await request.json();

  return proxyToBackend('/api/admin/vectors/search-test', {
    method: 'POST',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
}
