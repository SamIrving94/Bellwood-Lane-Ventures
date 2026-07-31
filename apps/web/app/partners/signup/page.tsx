import { Eyebrow, LogoLockup } from '@/components/brand';
import Link from 'next/link';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="text-center">
        <LogoLockup href="/instant-offer" />
        <p className="mt-8">
          <Eyebrow>Pre-register your firm</Eyebrow>
        </p>
        <h1 className="mt-2 font-semibold font-serif text-4xl leading-tight">
          Grab your referral code early.
        </h1>
        <p className="mt-4 text-body">
          You don&apos;t have to sign up to use our indicative-offer tool. We
          auto-create your code when you submit your first property. But if you
          want a code ready to share right now, pre-register here.{' '}
          <strong>Partner fee agreed in writing per deal.</strong>
        </p>
      </div>

      <div className="mt-12 rounded-lg border border-hair bg-white p-8 shadow-sm">
        <SignupForm />
      </div>

      <p className="mt-8 text-center text-body text-sm">
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
