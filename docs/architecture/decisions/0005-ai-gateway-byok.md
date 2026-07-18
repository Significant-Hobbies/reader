# ADR-0005: AI SDK + free-ai-gateway + BYOK (no server-side key storage)

**Date:** 2026-02-13 (AI SDK integrated); gateway pattern formalised ~2026-04-27
**Status:** Current
**Supersedes:** [archive/decisions.md ADR-04](../../archive/decisions.md)

## Context

Reader needs LLM chat and summarisation. Three paths were available: call
provider APIs directly, proxy through a self-hosted gateway, or use the
Workers AI binding directly.

## Decision

All server-side AI calls go through the fleet `free-ai-gateway`
(`AI_BASE_URL`, default `https://ai-gateway.sassmaker.com/v1`) using
`@ai-sdk/openai-compatible` + the Vercel AI SDK. The gateway enforces a
9500 Neuron/day fleet-wide cap and attributes spend per project via the
`x-gateway-project-id: reader` header.

Client-side BYOK: users supply their own OpenAI/Anthropic/Gemini API key,
which the browser sends per-request; the server proxies it directly to the
provider and **never persists it**. A local AI dev path
(`scripts/local-ai.mjs`) bridges a local LLM for zero-cost development.

- Model factory: `src/lib/ai-cloudflare.ts` (`getLanguageModel()`).
- Server-side streaming + summarisation: `src/worker/routes/ai.ts`.
- BYOK key normalisation: `normalizeApiKey()` in `src/lib/ai-server.ts`
  (length-capped, trimmed).
- Local AI bridge: `createLocalAITextStream()` in `src/lib/ai-server.ts`,
  gated by `isLocalCLIEnabled()` (`NODE_ENV === 'development'`).
- Extension AI chat: `/api/ext/chat` in `src/worker/routes/misc.ts` reuses the
  same gateway/BYOK logic, authenticated via `rdr_*` API keys.

## Rationale

- Single budget chokepoint across the fleet: the gateway owns the daily Neuron
  budget so no single project can exhaust it. The `x-gateway-project-id`
  header is required for per-project attribution.
- BYOK keys stored in the browser only → zero server-side key storage risk.
  Aligns with the security note in `README.md`.
- `@ai-sdk/openai-compatible` allows any OpenAI-compatible endpoint (Workers
  AI, OpenAI, Anthropic via OpenAI-compat, Gemini) without provider-specific
  SDKs.
- Vercel AI SDK `streamText` + `toTextStreamResponse` handles streaming
  uniformly across all providers.

## Tradeoffs

- BYOK means users must have their own API keys for non-free models.
- The gateway is a fleet dependency; if it is down, free AI is down. BYOK and
  local AI are the fallbacks.
- The default model (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) is a Workers
  AI model routed through the gateway; model selection is configurable.

## Alternatives considered

- **Direct provider SDKs:** multiple deps, no unified streaming, no budget
  control.
- **Workers AI binding directly:** only works on Cloudflare; no dev path and
  no multi-provider support.
- **Self-hosted OpenAI proxy (LiteLLM etc.):** operational overhead.

## Security notes

- BYOK keys: never written to the database or logs; normalised before use.
- `rdr_*` API keys (extension): only the SHA-256 hash is persisted; plaintext
  is shown once at creation. See [0006-mv3-side-panel.md](0006-mv3-side-panel.md).
