# @tanstack/react-router-with-db

## 0.1.1

### Patch Changes

- Start the required Collection sync run when an ordinary subscriber follows an abandoned suspended render. Deferred acquisition still starts no idle source sync run or acquisition attempt. ([#2229](https://github.com/TanStack/db/pull/2229))

  Ordinary subscription admission and deferred acquisition resumption throw during cleanup, including automatic GC. Effects created then return disposed handles. Failed setup releases partial ownership, and throwing callbacks cannot prevent healthy observers receiving cleanup status. Subscribers surviving cleanup retain demand for an explicit restart.

  SSR captures each reader's rows and Collection status. Hydration preserves that view through browser preloads, runtime errors, sibling commits, and delayed streamed records. Missing records reject when transport ends. Known pending results survive normal record-stream close. A new stream after client cleanup starts independently of prior failures.

  Empty loading SSR needs no preload. Rendering rows or readiness requires matching query preparation or explicit source Collection preparation. Streaming Suspense prepares its result. Unsupported preparation throws with guidance. Prepared non-streaming Suspense remains supported. The DbClient query hash includes an infinite query's initial limit and offset.

  Apps without `DbClient` exclude its SSR implementation. Its API stays unchanged.

  Svelte roots initialized with `hydrate()` must set `hydrating` on `DbProvider`. Nested providers inherit it. Each provider clears initial hydration after mount so new children read live rows.

## 0.1.0

### Minor Changes

- Add SSR through request-scoped `DbClient` instances, collection descriptors, ([#1564](https://github.com/TanStack/db/pull/1564))
  explicit collection-row hydration, live-query result snapshots, adapter sync
  metadata, and React and Svelte descriptor resolution.

  React live queries now derive identity from structured query IR. Opaque queries
  can provide `queryKey`; legacy dependency arrays and unkeyed opaque queries keep
  working with development warnings until 1.0.

  Add TanStack Router integration that streams live queries discovered during a
  Suspense render as pending promises which resolve to ordered result snapshots.
  The browser starts normal source sync and atomically replaces the snapshot when
  its live result is ready.
