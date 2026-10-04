# HTTP cache semantics security patch

GitHub's reviewed advisory for GHSA-ch52-4w7c-c8xp currently has no upstream
patched version. The published `http-cache-semantics@4.3.0` source also needs a
behavioral fix: client `max-stale` must not bypass non-storable or revalidation
rules, or shared-cache restrictions for `proxy-revalidate` and `Set-Cookie`.

This workspace pins the existing Astro build dependency to 4.3.0 and applies a
small local patch to those checks. The Reader landing's only affected path is
`landing-astro > astro > http-cache-semantics`; this does not add a runtime
dependency or a vulnerability allowlist.

The lockfile integrity, patch hash, and patched snapshot were synchronized
from the reviewed PostTrainLLM #191 resolution and checked by a subsequent
Fleet Workspace frozen install; no unrelated lock nodes were changed.

`pnpm test:dependency-security` exercises 27 cache behavior cases against the
package resolved through the `landing-astro` Astro install, including policy
serialization and ordinary `max-stale` age and URL bounds. Keep the patch until
the upstream source itself passes the same behavior tests.
