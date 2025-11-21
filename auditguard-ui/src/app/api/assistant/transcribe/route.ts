import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/assistant/transcribe
 * Transcribes audio to text using OpenAI Whisper API
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

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Transcription service not configured. Add OPENAI_API_KEY to environment.' },
        { status: 503 }
      );
    }

    const audioSize = audioBlob.size;
    const audioType = audioBlob.type;

    console.log('Transcribing audio:', {
      size: `${(audioSize / 1024).toFixed(2)} KB`,
      type: audioType,
    });

    // Convert blob to file for OpenAI
    const audioFile = new File([audioBlob], 'audio.webm', { type: audioType });

    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Whisper API error:', errorText);
      return NextResponse.json(
        { error: 'Transcription failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Transcription successful:', result.text.substring(0, 100));

    return NextResponse.json({
      text: result.text,
      confidence: 0.95,
      language: 'en',
      provider: 'openai-whisper',
    });
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
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    status: hasOpenAI ? 'available' : 'unconfigured',
    provider: 'openai-whisper',
    configured: hasOpenAI,
    supportedFormats: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg'],
    maxFileSize: '25MB',
  });
}
