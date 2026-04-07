'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { MicIcon, StopCircleIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type VoiceRecorderProps = {
  onTranscription: (text: string) => void;
};

export const VoiceRecorder = ({ onTranscription }: VoiceRecorderProps) => {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        for (const track of stream.getTracks()) track.stop();

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          toast.error('No audio recorded');
          return;
        }

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            throw new Error('Transcription failed');
          }

          const { text } = await res.json();
          if (text) {
            onTranscription(text);
            toast.success('Transcription added');
          } else {
            toast.error('No speech detected');
          }
        } catch {
          toast.error('Failed to transcribe audio');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  if (!supported) return null;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <>
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            {formatTime(seconds)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stopRecording}
            aria-label="Stop recording"
          >
            <StopCircleIcon className="h-5 w-5 text-destructive" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={startRecording}
          disabled={transcribing}
          aria-label={transcribing ? 'Transcribing...' : 'Record voice note'}
          title="Record voice note"
        >
          <MicIcon className={`h-5 w-5 ${transcribing ? 'animate-pulse text-muted-foreground' : 'text-muted-foreground'}`} />
        </Button>
      )}
    </div>
  );
};
