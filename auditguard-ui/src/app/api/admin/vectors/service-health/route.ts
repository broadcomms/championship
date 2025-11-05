import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  const cookies = request.headers.get('cookie');

  return proxyToBackend('/api/admin/vectors/service-health', {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}
