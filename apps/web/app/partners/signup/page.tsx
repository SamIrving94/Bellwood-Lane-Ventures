import Link from 'next/link';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="text-center">
        <Link
          href="/instant-offer"
          className="font-serif text-xl font-semibold tracking-tight"
        >
          BELLWOODS
          <span className="mx-2 inline-block h-px w-8 bg-[#DB5C5C] align-middle" />
          <span className="text-sm font-normal tracking-widest text-stone-500">
            LANE
          </span>
        </Link>
        <p className="mt-8 text-xs uppercase tracking-widest text-[#DB5C5C]">
          Pre-register your firm
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">
          Grab your referral code early.
        </h1>
        <p className="mt-4 text-stone-600">
          You don&apos;t have to sign up to use our indicative-offer tool — we
          auto-create your code when you submit your first property. But if
          you want a code ready to share right now, pre-register here.{' '}
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
          className="font-medium text-[#874646] underline underline-offset-4 hover:text-[#DB5C5C]"
        >
          Sign in →
        </Link>
      </p>
    </div>
  );
}
