import {
  extractProbateFromPdf,
  type ProbateExtract,
} from '@repo/document-pipeline';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { unauthorizedResponse, validateAgentAuth } from '../../_lib/auth';

/**
 * POST /agents/scout/process-probate-pdf
 *
 * Run a probate Grant PDF through the OCR + Citations pipeline and return a
 * typed `ProbateExtract` with citation spans tied back to the source PDF.
 *
 * Two request modes:
 *
 *   A. JSON body — the most common Paperclip-scout call.
 *      Content-Type: application/json
 *      Body:        { "pdfUrl": "https://..." }
 *
 *   B. Direct PDF upload — for the founder's manual "drag-drop" path.
 *      Content-Type: application/pdf
 *      Body:        <raw PDF bytes>
 *      Optional ?filename=Grant.pdf
 *
 * Auth: Authorization: Bearer ${BELLWOOD_API_KEY}.
 *
 * The pipeline degrades gracefully — never throws — so the response is
 * always 200 with a `ProbateExtract`. When something goes wrong, look at
 * `extract.confidence === 0` and `extract.errorReason`.
 */

const JsonBody = z.object({
  pdfUrl: z.string().url(),
  filename: z.string().optional(),
});

export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  const url = new URL(request.url);

  let extract: ProbateExtract;

  try {
    if (contentType.startsWith('application/pdf')) {
      // Mode B — raw PDF bytes
      const buf = await request.arrayBuffer();
      if (buf.byteLength === 0) {
        return NextResponse.json(
          { error: 'Empty PDF body' },
          { status: 400 },
        );
      }
      const filename =
        url.searchParams.get('filename')?.trim() || 'probate.pdf';
      extract = await extractProbateFromPdf({
        pdfBytes: new Uint8Array(buf),
        filename,
      });
    } else {
      // Mode A — JSON { pdfUrl }
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 },
        );
      }
      const parsed = JsonBody.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: parsed.error.flatten(),
          },
          { status: 400 },
        );
      }
      extract = await extractProbateFromPdf({
        pdfUrl: parsed.data.pdfUrl,
        ...(parsed.data.filename ? { filename: parsed.data.filename } : {}),
      });
    }
  } catch (err) {
    // The pipeline is itself graceful; this catch is a final safety net so
    // the agent loop never has to handle 500s.
    console.error(
      '[/agents/scout/process-probate-pdf] unexpected error',
      err,
    );
    return NextResponse.json(
      {
        extract: {
          deceasedName: null,
          dateOfDeath: null,
          dateOfGrant: null,
          grantType: 'unknown' as const,
          executors: [],
          solicitorFirm: null,
          totalEstateGrossPence: null,
          totalEstateNetPence: null,
          propertyAddresses: [],
          ihtPaidIndicator: null,
          confidence: 0,
          errorReason: `unexpected:${(err as Error)?.message ?? String(err)}`.slice(0, 200),
        },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ extract });
};
