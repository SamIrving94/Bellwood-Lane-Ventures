import { redirect } from 'next/navigation';

// The front door. Sellers are the audience who type the bare domain (from a
// letter, a card, a WhatsApp), so / lands on the seller surface — agents get
// a prominent band + nav link there. Kept as a temporary redirect on purpose:
// if a dedicated audience-split homepage ships later, / must be free to
// change (a 308 here would be cached by browsers/Google for a long time).
export default function HomeRedirect() {
  redirect('/sell');
}
