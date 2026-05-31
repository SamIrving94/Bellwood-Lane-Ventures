// Vitest-only stub for `@ai-sdk/anthropic`, `ai`, and `@repo/ai/keys`.
// deep-appraisal.ts imports from these at module level. The valuation
// tests don't exercise the LLM path; they cover the pure AVM math.
// Re-aliased to this empty module so the test resolver doesn't choke.

export const createAnthropic = () => () => null;
export const generateObject = async () => ({ object: null });
export const keys = () => ({ ANTHROPIC_API_KEY: undefined });
