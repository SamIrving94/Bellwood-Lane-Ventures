'use client';

import { MicIcon, SquareIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One-tap voice note → transcript. Records from the mic (MediaRecorder),
 * sends the audio to /api/transcribe (Whisper), and hands the text back via
 * onTranscript — the parent decides where it goes (usually the notes field).
 *
 * Why voice: speaking "the garden backs onto a railway line and the kitchen
 * needs gutting, but the street is lovely" takes 10 seconds and carries far
 * more signal than a star. The transcript is stored with the feedback and
 * mined for structured likes/dislikes, so every note compounds into the
 * founder taste profile.
 *
 * Audio itself is NOT stored — the transcript is the asset. Recording is
 * capped so a forgotten open mic can't run up transcription cost.
 */

const MAX_RECORDING_MS = 120_000;

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error';

type VoiceNoteRecorderProps = {
  onTranscript: (text: string) => void;
  compact?: boolean;
};

export function VoiceNoteRecorder({
  onTranscript,
  compact = false,
}: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (capRef.current) clearTimeout(capRef.current);
    timerRef.current = null;
    capRef.current = null;
    for (const track of recorderRef.current?.stream.getTracks() ?? []) {
      track.stop();
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState('transcribing');
      try {
        const form = new FormData();
        form.append('file', blob, 'voice-note.webm');
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          throw new Error(
            res.status === 503
              ? 'Transcription not configured'
              : 'Transcription failed'
          );
        }
        const data = (await res.json()) as { text?: string };
        const text = (data.text ?? '').trim();
        if (!text) throw new Error('Nothing heard — try again');
        onTranscript(text);
        setState('idle');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed');
        setState('error');
      }
    },
    [onTranscript]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        cleanup();
        if (blob.size > 0) {
          void transcribe(blob);
        } else {
          setState('idle');
        }
      };
      recorder.start();
      setState('recording');
      setElapsedSec(0);
      timerRef.current = setInterval(
        () => setElapsedSec((s) => s + 1),
        1000
      );
      capRef.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      setError('Microphone unavailable — check browser permissions');
      setState('error');
    }
  }, [cleanup, stopRecording, transcribe]);

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (state === 'recording') {
    return (
      <button
        type="button"
        aria-label="Stop recording"
        className="flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
        onClick={stopRecording}
      >
        <SquareIcon className={`${iconSize} fill-current`} />
        <span className="tabular-nums">
          {Math.floor(elapsedSec / 60)}:
          {String(elapsedSec % 60).padStart(2, '0')}
        </span>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
      </button>
    );
  }

  if (state === 'transcribing') {
    return (
      <span className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
        <Loader2Icon className={`${iconSize} animate-spin`} />
        Transcribing…
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Record a voice note"
        title="Record a voice note — say what you like or dislike about this property"
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        onClick={startRecording}
      >
        <MicIcon className={iconSize} />
        {!compact && 'Voice note'}
      </button>
      {state === 'error' && error && (
        <span className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      )}
    </span>
  );
}
