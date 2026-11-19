import {
  createMemo,
  createRenderEffect,
  createSignal,
  createStore,
  onCleanup,
  reconcile,
  runWithOwner,
  untrack,
} from 'solid-js'
import { ReactiveMap } from '@solid-primitives/map'
import {
  createLiveQueryObserver,
  getLiveQueryStatusFlags,
  getPublicCollection,
  isCollection,
  isSingleResultCollection,
  prepareLiveQueryValue,
  resolveLiveQueryValue,
  toBoundaryError,
} from '@tanstack/db'
import { createRowStore } from './store-materialization'
import type { Accessor } from 'solid-js'
import type {
  ChangeMessage,
  Collection,
  CollectionStatus,
  Context,
  GetResult,
  HealthNode,
  InferResultType,
  InitialQueryBuilder,
  LiveQueryHookConfig,
  LiveQueryObserver,
  LiveQueryStatusFlags,
  NonSingleResult,
  QueryBuilder,
  SingleResult,
} from '@tanstack/db'

const DEFAULT_GC_TIME_MS = 1

type InferConditionalResultType<TContext extends Context> =
  TContext extends SingleResult
    ? InferResultType<TContext> | []
    : InferResultType<TContext>

/**
 * Create a live query using a query function
 * @param queryFn - Query function that defines what data to fetch
 * @returns Accessor that returns data, waiting under `<Loading>` until the query is first ready, with state and status information as properties
 * @example
 * // Basic query with object syntax
 * const todosQuery = useLiveQuery((q) =>
 *   q.from({ todos: todosCollection })
 *    .where(({ todos }) => eq(todos.completed, false))
 *    .select(({ todos }) => ({ id: todos.id, text: todos.text }))
 * )
 *
 * @example
 * // With dependencies that trigger re-execution
 * const todosQuery = useLiveQuery(
 *   (q) => q.from({ todos: todosCollection })
 *          .where(({ todos }) => gt(todos.priority, minPriority())),
 * )
 *
 * @example
 * // Join pattern
 * const personIssues = useLiveQuery((q) =>
 *   q.from({ issues: issueCollection })
 *    .join({ persons: personCollection }, ({ issues, persons }) =>
 *      eq(issues.userId, persons.id)
 *    )
 *    .select(({ issues, persons }) => ({
 *      id: issues.id,
 *      title: issues.title,
 *      userName: persons.name
 *    }))
 * )
 *
 * @example
 * // Handle loading and error states
 * const todosQuery = useLiveQuery((q) =>
 *   q.from({ todos: todoCollection })
 * )
 *
 * return (
 *   <Switch>
 *     <Match when={todosQuery.isLoading}>
 *       <div>Loading...</div>
 *     </Match>
 *     <Match when={todosQuery.isLoadingError}>
 *       <div>Error: {todosQuery.status}</div>
 *     </Match>
 *     <Match when={todosQuery.isReady}>
 *       <For each={todosQuery()}>
 *         {(todo) => <li>{todo.text}</li>}
 *       </For>
 *     </Match>
 *   </Switch>
 * )
 *
 * @example
 * // Wait for the first ready state under a Loading boundary
 * const todosQuery = useLiveQuery((q) =>
 *   q.from({ todos: todoCollection })
 * )
 *
 * return (
 *   <Loading fallback={<div>Loading...</div>}>
 *     <For each={todosQuery()}>
 *       {(todo) => <li>{todo.text}</li>}
 *     </For>
 *   </Loading>
 * )
 */

// Overload 1: Accept query function that always returns QueryBuilder
export function useLiveQuery<TContext extends Context>(
  queryFn: (q: InitialQueryBuilder) => QueryBuilder<TContext>,
): Accessor<InferResultType<TContext>> & {
  state: ReactiveMap<string | number, GetResult<TContext>>
  collection: Collection<GetResult<TContext>, string | number, {}>
  status: CollectionStatus
} & LiveQueryStatusFlags

// Overload 1b: Accept query function that can return undefined/null
export function useLiveQuery<TContext extends Context>(
  queryFn: (
    q: InitialQueryBuilder,
  ) => QueryBuilder<TContext> | undefined | null,
): Accessor<InferConditionalResultType<TContext>> & {
  state: ReactiveMap<string | number, GetResult<TContext>>
  collection: Collection<GetResult<TContext>, string | number, {}> | null
  status: CollectionStatus | `disabled`
} & LiveQueryStatusFlags

/**
 * Create a live query using configuration object
 * @param config - Configuration object with query and options
 * @returns Accessor that returns data, waiting under `<Loading>` until the query is first ready, with state and status information as properties
 * @example
 * // Basic config object usage
 * const todosQuery = useLiveQuery(() => ({
 *   query: (q) => q.from({ todos: todosCollection }),
 *   gcTime: 60000
 * }))
 *
 * @example
 * // With query builder and options
 * const queryBuilder = new Query()
 *   .from({ persons: collection })
 *   .where(({ persons }) => gt(persons.age, 30))
 *   .select(({ persons }) => ({ id: persons.id, name: persons.name }))
 *
 * const personsQuery = useLiveQuery(() => ({ query: queryBuilder }))
 *
 * @example
 * // Handle all states uniformly
 * const itemsQuery = useLiveQuery(() => ({
 *   query: (q) => q.from({ items: itemCollection })
 * }))
 *
 * return (
 *   <Switch fallback={<div>{itemsQuery().length} items loaded</div>}>
 *     <Match when={itemsQuery.isLoading}>
 *       <div>Loading...</div>
 *     </Match>
 *     <Match when={itemsQuery.isLoadingError}>
 *       <div>Something went wrong</div>
 *     </Match>
 *     <Match when={!itemsQuery.isReady}>
 *       <div>Preparing...</div>
 *     </Match>
 *   </Switch>
 * )
 */
// Overload 2: Accept config object
export function useLiveQuery<TContext extends Context>(
  config: Accessor<LiveQueryHookConfig<TContext>>,
): Accessor<InferResultType<TContext>> & {
  state: ReactiveMap<string | number, GetResult<TContext>>
  collection: Collection<GetResult<TContext>, string | number, {}>
  status: CollectionStatus
} & LiveQueryStatusFlags

/**
 * Subscribe to an existing live query collection
 * @param liveQueryCollection - Pre-created live query collection to subscribe to
 * @returns Accessor that returns data, waiting under `<Loading>` until the query is first ready, with state and status information as properties
 * @example
 * // Using pre-created live query collection
 * const myLiveQuery = createLiveQueryCollection((q) =>
 *   q.from({ todos: todosCollection }).where(({ todos }) => eq(todos.active, true))
 * )
 * const todosQuery = useLiveQuery(() => myLiveQuery)
 *
 * @example
 * // Access collection methods directly
 * const existingQuery = useLiveQuery(() => existingCollection)
 *
 * // Use collection for mutations
 * const handleToggle = (id) => {
 *   existingQuery.collection.update(id, draft => { draft.completed = !draft.completed })
 * }
 *
 * @example
 * // Handle states consistently
 * const sharedQuery = useLiveQuery(() => sharedCollection)
 *
 * return (
 *  <Switch fallback={<div><For each={sharedQuery()}>{(item) => <Item {...item} />}</For></div>}>
 *    <Match when={sharedQuery.isLoading}>
 *      <div>Loading...</div>
 *    </Match>
 *    <Match when={sharedQuery.isLoadingError}>
 *      <div>Error loading data</div>
 *    </Match>
 *  </Switch>
 * )
 */
// Overload 3: Accept pre-created live query collection (non-single result)
export function useLiveQuery<
  TResult extends object,
  TKey extends string | number,
  TUtils extends Record<string, any>,
>(
  liveQueryCollection: Accessor<
    Collection<TResult, TKey, TUtils> & NonSingleResult
  >,
): Accessor<Array<TResult>> & {
  state: ReactiveMap<TKey, TResult>
  collection: Collection<TResult, TKey, TUtils>
  status: CollectionStatus
} & LiveQueryStatusFlags

// Overload 3b: Accept pre-created live query collection with singleResult: true
export function useLiveQuery<
  TResult extends object,
  TKey extends string | number,
  TUtils extends Record<string, any>,
>(
  liveQueryCollection: Accessor<
    Collection<TResult, TKey, TUtils> & SingleResult
  >,
): Accessor<TResult | undefined> & {
  state: ReactiveMap<TKey, TResult>
  collection: Collection<TResult, TKey, TUtils> & SingleResult
  status: CollectionStatus
} & LiveQueryStatusFlags

// Implementation - use function overloads to infer the actual collection type
export function useLiveQuery(
  configOrQueryOrCollection: (queryFn?: any) => any,
) {
  let previousCollection: ReturnType<typeof resolveLiveQueryValue> = null
  const resolveNext = (value: unknown) =>
    (previousCollection = resolveLiveQueryValue(value, {
      gcTime: DEFAULT_GC_TIME_MS,
      previousCollection,
      windowOwner: resolveNext,
    }))
  const collection = createMemo(
    () => {
      const value =
        configOrQueryOrCollection.length === 1
          ? configOrQueryOrCollection
          : configOrQueryOrCollection()
      // Query-input reads define binding dependencies. Compilation can drain
      // source rows synchronously; those reads belong to the result instead.
      const prepared = prepareLiveQueryValue(value, undefined)
      return untrack(() => {
        if (isCollection(prepared)) {
          prepared.startSyncImmediate()
          previousCollection = null
          return prepared as Collection
        }
        return resolveNext(prepared)
      })
    },
    { name: `TanstackDBCollectionMemo` },
  )

  // Reactive state that gets updated granularly through change events
  const state = new ReactiveMap<string | number, any>()

  // Keep the live Collection's result keys private while preserving one stable
  // Solid store per logical row. A row's public $key can belong to an upstream
  // Collection and is therefore not necessarily unique in this result.
  const rowsByKey = new Map<
    string | number,
    { value: any; update: (value: any) => void }
  >()
  let rowsCollection: Collection<any, any, any> | undefined
  const [data, setData] = createStore<Array<any>>([], {
    name: `TanstackDBData`,
  })

  // Collection publications are external events, but they can arrive while
  // Solid runs a computation: subscribing delivers the initial rows at once,
  // and a Collection write made from a memo publishes synchronously. Writes
  // into the hook's state therefore run outside any owner.
  const publish = (write: () => void) => runWithOwner(null, write)
  // Follows the current collection; change events write it in between.
  const [status, setStatus] = createSignal<CollectionStatus | `disabled`>(
    () => collection()?.status ?? `disabled`,
    { name: `TanstackDBStatus`, ownedWrite: true },
  )
  const [health, setHealth] = createSignal<HealthNode | undefined>(undefined, {
    ownedWrite: true,
  })
  const syncStatus = (view: {
    status: CollectionStatus | `disabled`
    health: HealthNode | undefined
  }) => {
    setStatus(view.status)
    setHealth(() => view.health)
  }
  const syncState = (entries: Iterable<[string | number, any]>) => {
    state.clear()
    for (const [key, value] of entries) state.set(key, value)
  }
  // Every status flag comes from the shared rule; a disabled query is ready.
  const flags = createMemo(() =>
    getLiveQueryStatusFlags(status() as CollectionStatus, health()),
  )

  // Helper to sync data array from collection in correct order
  const syncDataFromCollection = (
    currentCollection: Collection<any, any, any>,
  ) => {
    const nextRows: Array<any> = []
    const retainedKeys = new Set<string | number>()

    for (const [key, value] of currentCollection.entries()) {
      retainedKeys.add(key)

      const existing = rowsByKey.get(key)
      if (existing) {
        existing.update(value)
        nextRows.push(existing.value)
      } else {
        const row = createRowStore(value)
        rowsByKey.set(key, row)
        nextRows.push(row.value)
      }
    }

    for (const key of rowsByKey.keys()) {
      if (!retainedKeys.has(key)) rowsByKey.delete(key)
    }

    // Row stores keep their identity; the array follows result order.
    setData(reconcile(nextRows, null))
  }

  // The preload observer holds the Collection from the first read until the
  // subscribing effect owns it, so a Collection with a short gcTime is not
  // collected between readiness and the effect's subscription.
  let localWait:
    | {
        observer: LiveQueryObserver<any, any>
        collection: Collection<any, any, any>
      }
    | undefined
  let subscribedCollection: Collection<any, any, any> | undefined
  const releaseLocalWait = () => {
    localWait?.observer.dispose()
    localWait = undefined
  }
  onCleanup(releaseLocalWait)

  // Readiness is async: reading the result before the first ready state
  // waits under the nearest `<Loading>` boundary, and a load error reaches the
  // nearest `<Errored>` boundary. Each Collection waits once; later updates
  // are delivered by the subscription below.
  const ready = createMemo<true | Promise<true>>(
    () => {
      const currentCollection = collection()
      if (!currentCollection) return true
      // A crashed Collection also rejects preload; keep its crash visible.
      const fail = (error: unknown): never => {
        if (collection() === currentCollection) {
          setStatus(
            currentCollection.status === `crashed` ? `crashed` : `error`,
          )
        }
        throw toBoundaryError(error)
      }
      return untrack(() => {
        releaseLocalWait()
        // A first load that already failed answers the first read at once.
        if (
          currentCollection.status === `error` ||
          currentCollection.status === `crashed`
        ) {
          return fail(currentCollection.health.error?.cause)
        }
        const observer = createLiveQueryObserver(currentCollection)
        if (observer.getSnapshot().isReady) {
          observer.dispose()
          return true as const
        }
        localWait = { observer, collection: currentCollection }
        let preload: Promise<void>
        try {
          // Hold the Collection across the wait and until the effect subscribes.
          observer.subscribe(() => {})
          preload = observer.preload()
        } catch (error) {
          // A sync function that throws crashes the Collection as it starts.
          releaseLocalWait()
          return fail(error)
        }
        return preload.then(
          () => {
            if (
              localWait?.observer === observer &&
              subscribedCollection === currentCollection
            ) {
              releaseLocalWait()
            }
            return true as const
          },
          (error: unknown) => {
            if (localWait?.observer === observer) releaseLocalWait()
            return fail(error)
          },
        )
      })
    },
    { name: `TanstackDBReady`, lazy: true },
  )

  createRenderEffect(collection, (currentCollection) => {
    if (!currentCollection) {
      publish(() => {
        setStatus(`disabled` as const)
        setHealth(undefined)
        state.clear()
        rowsByKey.clear()
        rowsCollection = undefined
        setData(reconcile([], null))
      })
      return
    }

    if (rowsCollection !== currentCollection) {
      rowsByKey.clear()
      rowsCollection = currentCollection
    }

    // The shared observer owns subscription, the ready-race, and status; Solid
    // materializes into its keyed ReactiveMap (granular) + reconciled store.
    const observer = createLiveQueryObserver(currentCollection)
    // Clear any keys carried over from a previous collection before the new
    // observer re-seeds via `includeInitialState` (which only inserts current
    // rows, never deletes stale ones).
    publish(() => state.clear())
    const listener = (changes: Array<ChangeMessage<any>> | undefined) =>
      publish(() => {
        if (changes) {
          for (const change of changes) {
            switch (change.type) {
              case `insert`:
              case `update`:
                state.set(change.key, change.value)
                break
              case `delete`:
                state.delete(change.key)
                break
            }
          }
        } else {
          // Cleanup and other status-only publications carry no row deltas.
          // Rebuild the keyed view so it cannot diverge from ordered data.
          syncState(observer.getSnapshot().state ?? [])
        }
        syncDataFromCollection(currentCollection)
        syncStatus(observer.getSnapshot())
      })
    try {
      observer.subscribe(listener)
    } catch {
      // Starting sync can crash the Collection at once. Its status shows the
      // crash, and the first read reaches `<Errored>` through `ready`.
      observer.dispose()
      publish(() => {
        setStatus(currentCollection.status === `crashed` ? `crashed` : `error`)
        setHealth(() => currentCollection.health)
      })
      return
    }
    subscribedCollection = currentCollection
    if (localWait?.collection === currentCollection) {
      void Promise.resolve(untrack(ready)).then(() => {
        if (subscribedCollection === currentCollection) releaseLocalWait()
      })
    }
    // An already-ready empty collection produces no initial row batch. Bring
    // ordered data and status in line synchronously.
    publish(() => {
      syncDataFromCollection(currentCollection)
      syncStatus(observer.getSnapshot())
    })

    return () => {
      if (subscribedCollection === currentCollection) {
        subscribedCollection = undefined
      }
      observer.dispose()
    }
  })

  function getData() {
    // Waits under `<Loading>` until the current Collection is first ready.
    ready()
    const currentCollection = collection()
    // A crash ends reads at any time: the Collection can no longer serve
    // them. Later sync problems only show in `health`, with the data kept.
    if (status() === `crashed`) {
      throw toBoundaryError(currentCollection?.health.error?.cause)
    }
    if (currentCollection && isSingleResultCollection(currentCollection)) {
      return data[0]
    }
    return data
  }

  Object.defineProperties(getData, {
    status: {
      get() {
        return status()
      },
    },
    collection: {
      get() {
        return getPublicCollection(collection())
      },
    },
    state: {
      get() {
        return state
      },
    },
    isLoading: {
      get() {
        return flags().isLoading
      },
    },
    isReady: {
      get() {
        return flags().isReady || status() === `disabled`
      },
    },
    isIdle: {
      get() {
        return flags().isIdle
      },
    },
    isLoadingError: {
      get() {
        return flags().isLoadingError
      },
    },
    isCrashed: {
      get() {
        return flags().isCrashed
      },
    },
    isCleanedUp: {
      get() {
        return flags().isCleanedUp
      },
    },
    isSyncError: {
      get() {
        return flags().isSyncError
      },
    },
    health: {
      get() {
        return health()
      },
    },
  })
  return getData
}
