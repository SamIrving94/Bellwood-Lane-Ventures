import { LogoLockup } from '@/components/brand';
import Link from 'next/link';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="text-center">
        <LogoLockup
          href="/instant-offer"
          className="justify-center"
          wordmarkClassName="text-lg md:text-xl"
        />
        <p className="mt-8 text-leaf text-xs uppercase tracking-widest">
          Pre-register your firm
        </p>
        <h1 className="mt-2 font-semibold font-serif text-4xl leading-tight">
          Grab your referral code early.
        </h1>
        <p className="mt-4 text-stone-600">
          You don&apos;t have to sign up to use our indicative-offer tool — we
          auto-create your code when you submit your first property. But if you
          want a code ready to share right now, pre-register here.{' '}
          <strong>Partner fee agreed in writing per deal.</strong>
        </p>
      </div>

      <div className="mt-12 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <SignupForm />
      </div>

      <p className="mt-8 text-center text-sm text-stone-500">
        Already a partner?{' '}
        <Link
          href="/partners/login"
          className="font-medium text-leaf underline underline-offset-4 hover:text-leaf-dark"
        >
          Sign in →
        </Link>
      </p>
    </div>
  );
}
