/**
 * URL-safe slug from a title. Lives outside the route file because Next
 * only permits handler exports from route.ts; the DB unique constraint on
 * GuidePost.slug gets a numeric suffix on clash (see draft-blog).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
}
