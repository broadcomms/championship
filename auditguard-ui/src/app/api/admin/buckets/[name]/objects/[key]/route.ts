import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string; key: string } }
) {
  const cookies = request.headers.get('cookie');

  // URL encode the key to handle special characters
  const encodedKey = encodeURIComponent(params.key);

  return proxyToBackend(`/api/admin/buckets/${params.name}/objects/${encodedKey}`, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}
