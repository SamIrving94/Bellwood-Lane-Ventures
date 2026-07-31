/**
 * Escape user-supplied text before interpolating it into an HTML email body.
 *
 * Transactional emails are sent from our verified domain, so unescaped markup
 * in a name or firm field lets a submitter inject arbitrary links into a mail
 * that recipients have every reason to trust.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
