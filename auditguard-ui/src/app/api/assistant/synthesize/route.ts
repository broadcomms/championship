import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/assistant/synthesize
 * 
 * Converts text to speech using text-to-speech service
 * 
 * For now, this returns a 501 (Not Implemented) response with helpful error.
 * In production, this should integrate with:
 * - ElevenLabs API (recommended for quality)
 * - OpenAI TTS API
 * - Google Cloud Text-to-Speech
 * - Azure Speech Service
 * - Or use browser's built-in Web Speech API (client-side)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice_id, voice_settings } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    console.log('Speech synthesis request:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      voice_id,
      voice_settings,
    });

    // Try ElevenLabs API if available
    const elevenlabsKey = process.env.ELEVENLABS_API_KEY;

    if (elevenlabsKey) {
      try {
        // Default to Rachel voice if not specified
        const voiceId = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Rachel

        const elevenlabsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': elevenlabsKey,
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: voice_settings?.stability ?? 0.5,
                similarity_boost: voice_settings?.similarityBoost ?? 0.75,
                style: voice_settings?.style ?? 0.0,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (elevenlabsResponse.ok) {
          const audioBuffer = await elevenlabsResponse.arrayBuffer();
          console.log('✅ ElevenLabs synthesis successful:', audioBuffer.byteLength, 'bytes');

          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.byteLength.toString(),
              'X-Provider': 'elevenlabs',
            },
          });
        } else {
          console.error('ElevenLabs API error:', await elevenlabsResponse.text());
        }
      } catch (error) {
        console.error('ElevenLabs error:', error);
        // Fall through to fallback
      }
    }

    // Try OpenAI TTS as fallback
    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey) {
      try {
        // Map voice IDs to OpenAI voices
        const voiceMap: Record<string, string> = {
          'rachel': 'nova',
          'josh': 'onyx',
          'emily': 'shimmer',
          'adam': 'echo',
          'bella': 'alloy',
        };

        const openaiVoice = voiceMap[voice_id] || 'alloy';

        const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: openaiVoice,
            input: text,
            speed: voice_settings?.speed || 1.0,
          }),
        });

        if (openaiResponse.ok) {
          const audioBuffer = await openaiResponse.arrayBuffer();
          console.log('✅ OpenAI TTS synthesis successful:', audioBuffer.byteLength, 'bytes');

          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'X-Provider': 'openai-tts',
            },
          });
        }
      } catch (error) {
        console.error('OpenAI TTS error:', error);
      }
    }

    // Fallback to browser TTS
    return NextResponse.json(
      {
        error: 'Text-to-speech not configured',
        message: 'Add ELEVENLABS_API_KEY or OPENAI_API_KEY environment variable to enable server-side TTS',
        useFallback: true,
        implementation: 'Browser Web Speech API will be used automatically',
      },
      { status: 501 }
    );

  } catch (error) {
    console.error('Speech synthesis error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to synthesize speech',
        message: error instanceof Error ? error.message : 'Unknown error',
        useFallback: true,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/assistant/synthesize
 * Returns API status and configuration
 */
export async function GET() {
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  let provider = 'none';
  let status = 'not-configured';

  if (hasElevenLabs) {
    provider = 'elevenlabs';
    status = 'available';
  } else if (hasOpenAI) {
    provider = 'openai-tts';
    status = 'available';
  }

  return NextResponse.json({
    status,
    provider,
    configured: hasElevenLabs || hasOpenAI,
    fallback: 'Browser Web Speech API',
    note: hasElevenLabs
      ? 'Using ElevenLabs for high-quality text-to-speech'
      : hasOpenAI
      ? 'Using OpenAI TTS for text-to-speech'
      : 'Add ELEVENLABS_API_KEY or OPENAI_API_KEY to enable server-side TTS',
    documentation: {
      'ElevenLabs': 'https://elevenlabs.io/docs/api-reference/text-to-speech',
      'OpenAI TTS': 'https://platform.openai.com/docs/guides/text-to-speech',
      'Google Cloud TTS': 'https://cloud.google.com/text-to-speech',
      'Azure Speech': 'https://azure.microsoft.com/en-us/services/cognitive-services/text-to-speech/',
      'Web Speech API': 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API',
    },
    availableVoices: [
      { id: 'rachel', name: 'Rachel', description: 'Professional female voice', elevenlabs_id: '21m00Tcm4TlvDq8ikWAM' },
      { id: 'josh', name: 'Josh', description: 'Friendly male voice', elevenlabs_id: 'TxGEqnHWrfWFTfGW9XjX' },
      { id: 'emily', name: 'Emily', description: 'Formal female voice', elevenlabs_id: 'LcfcDJNUP1GQjkzn1xUU' },
      { id: 'adam', name: 'Adam', description: 'Confident male voice', elevenlabs_id: 'pNInz6obpgDQGcFmaJgB' },
      { id: 'bella', name: 'Bella', description: 'Expressive female voice', elevenlabs_id: 'EXAVITQu4vr4xnSDxMaL' },
    ],
  });
}
