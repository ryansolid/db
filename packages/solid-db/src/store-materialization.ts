import { createStore, reconcile } from 'solid-js'

/**
 * Materializes one result row as a Solid store.
 *
 * A Solid 2 store reads through to its source and keeps its own writes apart,
 * so the row borrows the Collection's value without copying or editing it.
 * Each update reconciles the next source value into the same store: fields
 * that did not change keep their values and notify nobody, and nested objects
 * are matched by source identity, so an unchanged nested object keeps its
 * store identity even when an array reorders around it.
 */
export function createRowStore<T extends object>(source: T) {
  const [row, setRow] = createStore<T>(source as never)
  return {
    value: row as T,
    update(nextSource: T) {
      if (nextSource === source) return
      const previous = source
      source = nextSource
      setRow(
        reconcile(nextSource, (item: unknown) =>
          // The root is the same row across updates. Nested objects are
          // the same value only when the source kept the same object.
          item === previous || item === nextSource ? undefined : item,
        ) as never,
      )
    },
  }
}
