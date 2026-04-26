'use client';

import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

type SuggestedPrompt = { label: string; prompt: string };

type Props = {
  suggestedPrompts: SuggestedPrompt[];
};

export function ConciergeChat({ suggestedPrompts }: Props) {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation, pending]);

  async function ask(question: string) {
    setError(null);
    const next: Message[] = [...conversation, { role: 'user', content: question }];
    setConversation(next);
    setInput('');
    setPending(true);
    try {
      const res = await fetch('/api/research/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversation, // history without the just-asked question
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong.');
        return;
      }
      setConversation([
        ...next,
        { role: 'assistant', content: data.answer },
      ]);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || pending) return;
    ask(input.trim());
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {conversation.length === 0 ? (
        <div className="space-y-4 p-6">
          <p className="text-sm text-slate-600">
            Try one of these to get started, or ask anything in the box below.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {suggestedPrompts.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => ask(p.prompt)}
                disabled={pending}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
              >
                <p className="font-medium text-sm">{p.label}</p>
                <p className="mt-1 text-xs text-slate-500">{p.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
          {conversation.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-5 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-amber-100 text-amber-950'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-5 py-3 text-sm text-slate-500">
                George is thinking
                <span className="ml-1 animate-pulse">…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about UK property…"
            disabled={pending}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? 'Thinking…' : 'Ask'}
          </button>
          {conversation.length > 0 && (
            <button
              type="button"
              onClick={() => setConversation([])}
              disabled={pending}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-600 transition hover:border-slate-400 disabled:opacity-50"
            >
              New
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
