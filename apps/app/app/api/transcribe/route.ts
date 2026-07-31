import { auth } from '@repo/auth/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Transcription not configured' },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  // Forward to OpenAI Whisper
  const whisperForm = new FormData();
  whisperForm.append('file', file, 'recording.webm');
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
    console.error('Whisper API error:', err);
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 502 }
    );
  }

  const result = await response.json();
  return NextResponse.json({ text: result.text });
}
