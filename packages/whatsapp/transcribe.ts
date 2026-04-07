import { writeFile, unlink, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keys } from './keys';

async function downloadTwilioAudio(
  mediaUrl: string,
  contentType: string
): Promise<string> {
  const env = keys();

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio environment variables are not configured');
  }

  // Twilio media URLs require basic auth
  const credentials = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!audioRes.ok) {
    throw new Error(`Failed to download audio: ${audioRes.statusText}`);
  }

  // Pick file extension from content type
  const ext = contentType.includes('ogg')
    ? 'ogg'
    : contentType.includes('mpeg') || contentType.includes('mp3')
      ? 'mp3'
      : contentType.includes('mp4') || contentType.includes('m4a')
        ? 'mp4'
        : 'ogg';

  const buffer = Buffer.from(await audioRes.arrayBuffer());
  const filePath = join(tmpdir(), `twilio_audio_${Date.now()}.${ext}`);
  await writeFile(filePath, buffer);

  return filePath;
}

async function transcribeWithWhisper(
  audioPath: string,
  contentType: string
): Promise<string> {
  const env = keys();

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const stats = await stat(audioPath);
  if (stats.size === 0) {
    throw new Error('Audio file is empty');
  }

  const fileBuffer = await readFile(audioPath);
  const blob = new Blob([fileBuffer], { type: contentType });

  const formData = new FormData();
  formData.append('file', blob, `audio.${audioPath.split('.').pop()}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Whisper API error: ${JSON.stringify(error)}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}

export async function transcribeAudio(
  mediaUrl: string,
  contentType: string
): Promise<string> {
  let audioPath: string | null = null;

  try {
    audioPath = await downloadTwilioAudio(mediaUrl, contentType);
    const transcription = await transcribeWithWhisper(audioPath, contentType);
    return transcription;
  } finally {
    if (audioPath) {
      unlink(audioPath).catch(() => {
        // best-effort cleanup
      });
    }
  }
}
