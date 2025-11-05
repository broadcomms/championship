import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const cookies = request.headers.get('cookie');
  const { searchParams } = new URL(request.url);

  const queryParams = new URLSearchParams();
  if (searchParams.get('prefix')) queryParams.set('prefix', searchParams.get('prefix')!);
  if (searchParams.get('limit')) queryParams.set('limit', searchParams.get('limit')!);

  const queryString = queryParams.toString();
  const path = `/api/admin/buckets/${params.name}/objects${queryString ? `?${queryString}` : ''}`;

  return proxyToBackend(path, {
    method: 'GET',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    credentials: 'include',
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const cookies = request.headers.get('cookie');
  const body = await request.json();

  return proxyToBackend(`/api/admin/buckets/${params.name}/objects`, {
    method: 'DELETE',
    headers: {
      ...(cookies && { Cookie: cookies }),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
}
