'use client';

type GlobalErrorProperties = {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
};

export default function GlobalError({
  error: _error,
  reset,
}: GlobalErrorProperties) {
  return (
    <html lang="en">
      <body>
        <h1>Oops, something went wrong</h1>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}
