import type { Metadata } from 'next';
import { SellerForm } from './seller-form';

export const metadata: Metadata = {
  title: 'Sell Your Property Fast — Bellwoods Lane',
  description:
    'Get a guaranteed cash offer within 48 hours. No chains, no fees, no hassle. We buy any property in any condition.',
};

const SellerIntakePage = () => {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Need to sell your property quickly?
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          We provide guaranteed cash offers within 48 hours. No chains, no agent
          fees, no stress. We cover your legal costs too.
        </p>
      </div>

      <SellerForm />

      {/* Trust signals */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-gray-600">
        <div>
          <p className="text-lg font-bold text-gray-900">48h</p>
          <p>Cash offer guaranteed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">14-28 days</p>
          <p>To completion</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">&pound;0</p>
          <p>No fees or hidden costs</p>
        </div>
      </div>
    </div>
  );
};

export default SellerIntakePage;
