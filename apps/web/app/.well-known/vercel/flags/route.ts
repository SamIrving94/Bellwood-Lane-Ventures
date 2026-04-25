// Vercel feature-flags discovery endpoint.
import { getFlags } from '@repo/feature-flags/access';

export async function GET(request: Request): Promise<Response> {
  // @ts-expect-error - getFlags expects NextRequest from a different copy
  // of next; runtime shape is identical.
  return getFlags(request);
}
