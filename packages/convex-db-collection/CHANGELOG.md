# @tanstack/convex-db-collection

## 0.2.0

### Minor Changes

- Add a Convex collection adapter with typed query subscriptions, full-row sync, automatic reactive pagination with on-demand windows for a fixed ordered query, durable offline mutation replay, optimistic mutation handlers, and support for both Convex JavaScript and React clients. ([#2230](https://github.com/TanStack/db/pull/2230))

  Add opt-in mutation codecs to the durable outbox while preserving the default wire format and retaining unreadable codec records for recovery.

### Patch Changes

- Updated dependencies [[`db476b8`](https://github.com/TanStack/db/commit/db476b8ed9755e0c0b10b833d187354b4c63585c), [`5649a07`](https://github.com/TanStack/db/commit/5649a07d468117891193c2e4cde9c7706308b1cd), [`7538afd`](https://github.com/TanStack/db/commit/7538afd2fa838340aaa63fca8b221154eb0b1572), [`6c1ca8f`](https://github.com/TanStack/db/commit/6c1ca8f8f9efe437d3cea61b5b9d0a086e2a5e34), [`30175be`](https://github.com/TanStack/db/commit/30175be483fa70799da579e2c407fb7ed9f2b435), [`4c39add`](https://github.com/TanStack/db/commit/4c39add293adb65b4f5537628849f97083a31531), [`1640de8`](https://github.com/TanStack/db/commit/1640de834bca0588f91432ea80a0f4569157e9dc), [`367ea7c`](https://github.com/TanStack/db/commit/367ea7c11e7dee5ca48ba524e55da2a6935d55fb), [`7d9ed02`](https://github.com/TanStack/db/commit/7d9ed02e085d11e871e4b6424d47e3c0d7073023), [`45eeef8`](https://github.com/TanStack/db/commit/45eeef81a7c64966473315558f46e8a53b00e462)]:
  - @tanstack/offline-transactions@1.2.0
  - @tanstack/db@0.16.0
