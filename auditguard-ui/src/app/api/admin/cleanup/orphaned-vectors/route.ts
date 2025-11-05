import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api-proxy';

export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup Route] POST request received');
    const cookies = request.headers.get('cookie');
    console.log('[Cleanup Route] Cookies:', cookies ? 'present' : 'missing');

    const result = await proxyToBackend('/api/admin/cleanup/orphaned-vectors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies && { Cookie: cookies }),
      },
      credentials: 'include',
    });

    console.log('[Cleanup Route] Backend response status:', result.status);
    return result;
  } catch (error) {
    console.error('[Cleanup Route] Error:', error);
    return new Response(JSON.stringify({
      error: 'Proxy error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
