import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sell Your Property Fast — Bellwood Ventures',
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

      <form
        action="/sell/thank-you"
        method="GET"
        className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
      >
        {/* Address */}
        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700"
          >
            Property Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            required
            placeholder="e.g. 42 Oak Lane, London"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {/* Postcode */}
        <div>
          <label
            htmlFor="postcode"
            className="block text-sm font-medium text-gray-700"
          >
            Postcode
          </label>
          <input
            id="postcode"
            name="postcode"
            type="text"
            required
            placeholder="e.g. SE18 7AB"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase"
          />
        </div>

        {/* Property type + bedrooms */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="propertyType"
              className="block text-sm font-medium text-gray-700"
            >
              Property Type
            </label>
            <select
              id="propertyType"
              name="propertyType"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="semi-detached">Semi-detached</option>
              <option value="terraced">Terraced</option>
              <option value="detached">Detached</option>
              <option value="flat">Flat</option>
              <option value="bungalow">Bungalow</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="bedrooms"
              className="block text-sm font-medium text-gray-700"
            >
              Bedrooms
            </label>
            <select
              id="bedrooms"
              name="bedrooms"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="4">4</option>
              <option value="5">5+</option>
            </select>
          </div>
        </div>

        {/* Reason for selling */}
        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-gray-700"
          >
            Why are you selling?
          </label>
          <select
            id="reason"
            name="reason"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select a reason...</option>
            <option value="chain_break">
              My sale fell through / chain broke
            </option>
            <option value="probate">
              Inherited property / probate
            </option>
            <option value="relocation">
              Relocating for work or personal reasons
            </option>
            <option value="repossession">
              Facing repossession
            </option>
            <option value="short_lease">
              Short lease on my property
            </option>
            <option value="other">Other reason</option>
          </select>
        </div>

        {/* Asking price */}
        <div>
          <label
            htmlFor="askingPrice"
            className="block text-sm font-medium text-gray-700"
          >
            What price are you looking for? (optional)
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-2 text-sm text-gray-500">
              &pound;
            </span>
            <input
              id="askingPrice"
              name="askingPrice"
              type="number"
              placeholder="e.g. 200000"
              className="w-full rounded-md border py-2 pl-7 pr-3 text-sm"
            />
          </div>
        </div>

        {/* Contact details */}
        <div className="border-t pt-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Your Contact Details
          </h3>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Get My Free Cash Offer
        </button>

        <p className="text-center text-xs text-gray-500">
          No obligation. We&apos;ll get back to you within 48 hours with a
          guaranteed cash offer.
        </p>
      </form>

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
