/**
 * @repo/document-pipeline
 *
 * Probate-grant PDF pipeline:
 *   1. Mistral OCR (mistral-ocr-latest) for grounded per-page markdown
 *   2. Anthropic Files API (beta `files-api-2025-04-14`) upload
 *   3. Claude Sonnet with the Citations API (beta `citations-2025-04-14`)
 *   4. Structured `ProbateExtract` with per-field citation spans
 *
 * All exported entry points are server-only.
 */

export { extractProbateFromPdf } from './probate-extract';
export type { ProbatePdfInput, ExtractOptions } from './probate-extract';

export { runMistralOcr } from './mistral-ocr';
export type {
  MistralOcrInput,
  MistralOcrPage,
  MistralOcrResult,
} from './mistral-ocr';

export { emptyProbateExtract } from './types';
export type {
  Citation,
  CitedExecutor,
  CitedPropertyAddress,
  CitedValue,
  GrantType,
  ProbateExtract,
} from './types';
