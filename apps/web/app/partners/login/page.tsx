import { LogoLockup } from '@/components/brand';
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
        <LogoLockup href="/instant-offer" />
        <h1 className="mt-10 font-semibold font-serif text-4xl">
          Claim your partner dashboard.
        </h1>
        <p className="mt-3 text-body">
          Already used our instant-offer tool as an agent? Your account is
          already there. Enter your work email and we&apos;ll send you a
          one-click sign-in link.
        </p>
      </div>

      {errorMsg && (
        <div className="mt-8 rounded-md border border-hair bg-soft p-4 text-sm text-wax">
          {errorMsg}
        </div>
      )}

      <div className="mt-10 rounded-lg border border-hair bg-white p-8 shadow-sm">
        <LoginForm />
      </div>

      <p className="mt-8 text-center text-body text-sm">
        Not a partner yet?{' '}
        <Link
          href="/partners/signup"
          className="font-medium text-leaf underline underline-offset-4 hover:text-leaf-dark"
        >
          Apply →
        </Link>
      </p>
    </div>
  );
}
