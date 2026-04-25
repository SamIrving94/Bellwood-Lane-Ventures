import { redirect } from 'next/navigation';

// The CMS-driven marketing home is replaced by the Instant Offer surface.
// Anyone hitting / is redirected straight to the product.
export default function HomeRedirect() {
  redirect('/instant-offer');
}
