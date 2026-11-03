---
'@tanstack/solid-db': major
---

Move `@tanstack/solid-db` to Solid 2. It now requires `solid-js` 2.0.0-rc.20 or later; Solid 1 apps stay on 0.3.x or the earlier 1.0 release candidates.

- Reading `query()` is a Solid 2 async read. It waits under the nearest `<Loading>` until the query is first ready, and later updates arrive in place. A failed first load and a crash reach the nearest `<Errored>`. Status properties, `health` and `state` never wait, and `state` holds rows synced before the first ready state.
- `createResource`, `<Suspense>` and `<ErrorBoundary>` are replaced by an async memo, `<Loading>` and `<Errored>`.
- Rows are Solid 2 stores over the Collection's values, reconciled in place on update, so unchanged fields and nested objects keep their identity and notify nobody.
- Collection publications write the hook's state outside any owner, since they can arrive while Solid runs a computation.
