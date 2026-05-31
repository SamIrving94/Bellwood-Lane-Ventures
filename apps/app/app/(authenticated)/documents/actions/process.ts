'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  extractProbateFromPdf,
  type ProbateExtract,
} from '@repo/document-pipeline';

type ProcessResult =
  | { id: string }
  | { error: string };

/**
 * Server action: receives an uploaded PDF, runs the document pipeline,
 * persists a DocumentExtract row, returns the new id so the client can
 * navigate to the detail view.
 *
 * Pipeline today is probate-grant-shaped — for `lease`, `contract`, and
 * `other` docType values we still call extractProbateFromPdf so the OCR
 * + Files API path runs, but Claude's output for those will have null
 * probate-specific fields. Future iterations add per-type prompts.
 */
export async function processUploadedPdf(
  formData: FormData,
): Promise<ProcessResult> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No PDF provided.' };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { error: 'PDF larger than 25 MB. Split it first.' };
  }

  const docTypeRaw = String(formData.get('docType') ?? 'probate');
  const docType = (
    ['probate', 'lease', 'contract', 'other'] as const
  ).includes(docTypeRaw as 'probate')
    ? (docTypeRaw as 'probate' | 'lease' | 'contract' | 'other')
    : 'other';

  const dealIdRaw = String(formData.get('dealId') ?? '').trim();
  const dealId = dealIdRaw.length > 0 ? dealIdRaw : null;

  let extract: ProbateExtract;
  try {
    const buf = await file.arrayBuffer();
    extract = await extractProbateFromPdf({
      pdfBytes: new Uint8Array(buf),
      filename: file.name,
    });
  } catch (err) {
    return {
      error: `Pipeline crashed: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  // Pull the two columns we want to surface in the list view without having
  // to re-parse the full JSON every time. Both nullable.
  const deceasedName = extract.deceasedName?.value ?? null;
  const primaryAddress =
    extract.propertyAddresses[0]?.address ?? null;

  try {
    const row = await database.documentExtract.create({
      data: {
        filename: file.name,
        docType,
        dealId,
        uploadedBy: userId,
        confidence: extract.confidence,
        deceasedName,
        primaryAddress,
        errorReason: extract.errorReason ?? null,
        // Round-trip via JSON to satisfy Prisma's InputJsonValue at the
        // boundary (the typed shape doesn't have an index signature).
        extractJson: JSON.parse(JSON.stringify(extract)),
      },
      select: { id: true },
    });
    return { id: row.id };
  } catch (err) {
    return {
      error: `Could not save extract: ${(err as Error)?.message ?? String(err)}`,
    };
  }
}
