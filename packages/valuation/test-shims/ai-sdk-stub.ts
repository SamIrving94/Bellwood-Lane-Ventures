// Vitest-only stub for `@repo/ai/claude`. deep-appraisal.ts and
// comp-rationale-llm.ts import from it at module level. The valuation tests
// don't exercise the LLM path; they cover the pure AVM math. Every call
// reports "no provider" so the code takes its graceful null branch.

export const CLAUDE_HAIKU = 'claude-haiku-4-5';
export const CLAUDE_SONNET = 'claude-sonnet-4-5';
export const CLAUDE_OPUS = 'claude-opus-4-7';
export const hasLlmProvider = () => false;
export const callClaude = async () => null;
export const callClaudeForJson = async () => null;
export const callClaudeForObject = async () => null;
export const callClaudeWithMeta = async () => ({
  text: null,
  model: CLAUDE_SONNET,
  provider: null,
  viaFallback: false,
});
