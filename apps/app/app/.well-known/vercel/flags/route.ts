// Vercel feature-flags discovery endpoint.
// Wrapped without `NextRequest` type import so the inferred GET type is
// portable across the multiple Next.js versions resolved in node_modules.
import { getFlags } from '@repo/feature-flags/access';

export async function GET(request: Request): Promise<Response> {
  // @ts-expect-error - getFlags expects NextRequest from a different copy
  // of next; runtime shape is identical.
  return getFlags(request);
}
