import Link from 'next/link';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMsg = (() => {
    switch (error) {
      case 'expired':
        return 'That link has expired. Please request a new one.';
      case 'missing':
        return 'Missing sign-in token.';
      default:
        return null;
    }
  })();

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="text-center">
        <Link
          href="/instant-offer"
          className="font-serif text-xl font-semibold tracking-tight"
        >
          BELLWOOD
          <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
          <span className="text-sm font-normal tracking-widest text-slate-500">
            VENTURES
          </span>
        </Link>
        <h1 className="mt-10 font-serif text-4xl font-semibold">
          Sign in to the partner portal.
        </h1>
        <p className="mt-3 text-slate-600">
          We&apos;ll email you a magic link.
        </p>
      </div>

      {errorMsg && (
        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {errorMsg}
        </div>
      )}

      <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <LoginForm />
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Not a partner yet?{' '}
        <Link
          href="/partners/signup"
          className="font-medium text-[#0A2540] underline underline-offset-4 hover:text-[#C6A664]"
        >
          Apply →
        </Link>
      </p>
    </div>
  );
}
