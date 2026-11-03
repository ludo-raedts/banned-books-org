// Single source of truth for which LLM each role uses.
//
// Every script and route imports its model id from here instead of hardcoding
// one, so the next provider retirement is a one-line change (or an env
// override) rather than a 40-file sweep. Introduced for the 2026-12-01 Gemini
// 2.5 shutdown and the 2027-01-14 GPT-4o / GPT-4.1 retirement.
//
// Roles, not models:
//   OPENAI_FAST    — high-volume classify / judge / short generation
//                    (was gpt-4o-mini, gpt-4.1-mini). OpenAI's named successor.
//   OPENAI_STRONG  — senior adjudicator / nuance-heavy generation
//                    (was gpt-4o, gpt-4.1). Same price tier as gpt-4o.
//   GEMINI_FLASH   — cheap Gemini pass incl. googleSearch grounding
//                    (was gemini-2.5-flash). Google's named successor.
//   GEMINI_STRONG  — high-stakes Gemini pass (was gemini-2.5-pro).
//
// Verified 2026-11-03 against the live APIs:
//   - gpt-6-* reject `max_tokens` (use max_completion_tokens) and only accept a
//     non-default temperature with reasoning_effort 'none'. Default effort is
//     'medium', whose hidden reasoning tokens would eat tight output budgets,
//     so every chat call spreads OPENAI_NO_REASONING.
//   - gemini-3.5-flash-lite rejects thinkingBudget (400 INVALID_ARGUMENT); use
//     thinkingLevel MINIMAL. gemini-3.8-flash rejects MINIMAL; LOW is its floor.
//   - The reverse also holds: overriding a role with a gpt-4o/4.1 id fails with
//     400 "Unrecognized request argument: reasoning_effort". Overrides must be
//     gpt-5.1+ ids.

import { ThinkingLevel } from '@google/genai'

export const OPENAI_FAST = process.env.OPENAI_MODEL_FAST ?? 'gpt-6-luna'
export const OPENAI_STRONG = process.env.OPENAI_MODEL_STRONG ?? 'gpt-6-sol'

export const GEMINI_FLASH = process.env.GEMINI_MODEL_FLASH ?? 'gemini-3.5-flash-lite'
export const GEMINI_STRONG = process.env.GEMINI_MODEL_STRONG ?? 'gemini-3.8-flash'

/** Spread into chat.completions.create params: GPT-4o-like behaviour (no hidden reasoning, temperature honoured). */
export const OPENAI_NO_REASONING = { reasoning_effort: 'none' } as const

/** thinkingConfig for GEMINI_FLASH: the successor of `thinkingBudget: 0`. */
export const GEMINI_FLASH_NO_THINKING = { thinkingLevel: ThinkingLevel.MINIMAL }

/** USD per token, standard tier, for scripts that print a cost estimate. */
export const OPENAI_COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'gpt-6-luna': { input: 0.10 / 1_000_000, output: 0.50 / 1_000_000 },
  'gpt-6-sol': { input: 2.00 / 1_000_000, output: 10.00 / 1_000_000 },
}
