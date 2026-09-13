import { isFounder } from '@repo/auth/server';
import { NextResponse } from 'next/server';

/**
 * Voice note → text for the founder feedback loop (see
 * `voice-note-recorder.tsx`). Audio is forwarded to OpenAI Whisper and only
 * the transcript is returned — the audio is never stored.
 *
 * Ops note: this route reads `OPENAI_API_KEY` directly, so it must be set on
 * the **bellwood-app** Vercel project (the dashboard), not just bellwood-api.
 * 9 Sep 2026: a trainee saw "Transcription not configured" in prod because
 * the key was only on the api project. The 503 message below names the key
 * and project so the next person doesn't have to dig.
 */

const NOT_CONFIGURED_HINT =
  'Add OPENAI_API_KEY to the bellwood-app Vercel project, then redeploy.';

/**
 * Whisper picks the decoder from the filename extension, so the name we
 * hand it has to match the bytes. Chrome/Android record `audio/webm`;
 * iOS Safari records `audio/mp4`. Labelling an mp4 as `.webm` fails decode.
 */
const extensionForMime = (mime: string): string => {
  const base = mime.split(';')[0]?.trim().toLowerCase();
  switch (base) {
    case 'audio/mp4':
    case 'audio/x-m4a':
    case 'audio/m4a':
      return 'm4a';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'video/mp4':
      return 'mp4';
    default:
      return 'webm';
  }
};

export async function POST(request: Request) {
  if (!(await isFounder())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      '[transcribe] OPENAI_API_KEY is not set on this deployment — voice notes cannot be transcribed.',
      NOT_CONFIGURED_HINT
    );
    return NextResponse.json(
      { error: 'Transcription not configured', hint: NOT_CONFIGURED_HINT },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: 'No audio file provided' },
      { status: 400 }
    );
  }

  // Forward to OpenAI Whisper
  const whisperForm = new FormData();
  whisperForm.append('file', file, `recording.${extensionForMime(file.type)}`);
  whisperForm.append('model', 'whisper-1');

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('Whisper API error:', response.status, err);
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 502 }
    );
  }

  const result = await response.json();
  return NextResponse.json({ text: result.text });
}
