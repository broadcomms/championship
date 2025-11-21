import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/assistant/transcribe
 * Transcribes audio to text using LiquidMetal AI Whisper (via backend)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;

    if (!audioBlob) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend API URL not configured' },
        { status: 503 }
      );
    }

    // Extract workspaceId and language from query params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const language = request.nextUrl.searchParams.get('language') || 'en';

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    const audioSize = audioBlob.size;
    const audioType = audioBlob.type;

    console.log('Forwarding transcription to backend:', {
      size: `${(audioSize / 1024).toFixed(2)} KB`,
      type: audioType,
      workspaceId,
      language,
    });

    // Forward to backend with language parameter
    const backendFormData = new FormData();
    backendFormData.append('audio', audioBlob);

    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/assistant/transcribe?language=${language}`,
      {
        method: 'POST',
        headers: {
          // Forward auth cookies
          'Cookie': request.headers.get('cookie') || '',
        },
        body: backendFormData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend transcription error:', errorText);
      return NextResponse.json(
        { error: 'Transcription failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Transcription successful:', result.text?.substring(0, 100) || 'empty');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/assistant/transcribe
 * Returns API status
 */
export async function GET() {
  const hasBackend = !!process.env.NEXT_PUBLIC_API_URL;

  return NextResponse.json({
    status: hasBackend ? 'available' : 'unconfigured',
    provider: 'liquidmetal-whisper',
    configured: hasBackend,
    supportedFormats: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg'],
    maxFileSize: '25MB',
  });
}
