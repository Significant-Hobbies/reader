// worker.mjs — custom Worker entry that wraps OpenNext.
//
// Keep this as a pass-through wrapper so Durable Object classes can be
// re-exported from the configured Worker entrypoint. Homepage HTML is not
// cached here because build-hashed Next chunks make stale HTML deploy-unsafe.

import openNext from "./.open-next/worker.js";

// Durable Objects must be re-exported from the entry that wrangler.toml
// points at, otherwise the bindings can't resolve them at deploy time.
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

export default openNext;
