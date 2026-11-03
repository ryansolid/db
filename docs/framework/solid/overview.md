---
title: TanStack DB Solid Adapter
id: adapter
---

## Installation

```sh
npm install @tanstack/solid-db solid-js@next
```

`@tanstack/solid-db` 1.0 requires Solid 2 (`solid-js` 2.0.0-rc.20 or later). Solid 1 apps use `@tanstack/solid-db` 0.3.x or the earlier 1.0 release candidates (1.0.0-rc.1.2 and before).

## Solid Primitives

See the [Solid Functions Reference](./reference/index.md) to see the full list of primitives available in the Solid Adapter.

For comprehensive documentation on writing queries (filtering, joins, aggregations, etc.), see the [Live Queries Guide](../../guides/live-queries).

## Basic Usage

### useLiveQuery

The `useLiveQuery` primitive creates a live query that automatically updates your component when data changes. Call the returned accessor to read its data; status fields such as `isLoading` and `status` are reactive properties:

```tsx
import { useLiveQuery } from '@tanstack/solid-db'
import { eq } from '@tanstack/db'
import { For, Loading } from 'solid-js'

function TodoList() {
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => eq(todos.completed, false))
     .select(({ todos }) => ({ id: todos.id, text: todos.text }))
  )

  return (
    <Loading fallback={<div>Loading...</div>}>
      <ul>
        <For each={query()}>
          {(todo) => <li>{todo.text}</li>}
        </For>
      </ul>
    </Loading>
  )
}
```

**Note:** `query()` reads the array; `query.isLoading` and `query.status` read reactive status properties.

### Loading and errors

Reading `query()` is an async read in Solid 2. Until the query is first ready, the read waits and the nearest `<Loading>` boundary shows its fallback. After that, later updates arrive in place and the boundary does not show its fallback again.

A first load that fails, and a crash at any time, reach the nearest `<Errored>` boundary. The boundary receives the sync adapter's error when it is an `Error`, and otherwise an `Error` whose `cause` is the value the adapter reported. Sync problems after the first ready state only show in `query.health`, with the data kept.

```tsx
import { Errored, For, Loading } from 'solid-js'

<Errored fallback={(error) => <div>{error().message}</div>}>
  <Loading fallback={<div>Loading...</div>}>
    <For each={query()}>{(todo) => <li>{todo.text}</li>}</For>
  </Loading>
</Errored>
```

The status properties never wait, so `query.isLoading`, `query.isReady`, `query.status`, `query.health` and `query.state` can be read outside a boundary. While a query loads, rows that the source has already synced are in `query.state` before `query()` is ready.

### Reactive Queries with Signals

Solid uses fine-grained reactivity, which means queries automatically track and respond to signal changes. Simply call signals inside your query function, and Solid will automatically recompute when they change:

```tsx
import { createSignal } from 'solid-js'
import { useLiveQuery } from '@tanstack/solid-db'
import { gt } from '@tanstack/db'

function FilteredTodos(props: { minPriority: number }) {
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => gt(todos.priority, props.minPriority))
  )

  return <div>{query().length} high-priority todos</div>
}
```

When `props.minPriority` changes, Solid's reactivity system automatically:
1. Detects the prop access inside the query function
2. Cleans up the previous live query collection
3. Creates a new query with the updated value
4. Updates the component with the new data

#### Using Signals from Component State

```tsx
import { createSignal } from 'solid-js'
import { useLiveQuery } from '@tanstack/solid-db'
import { eq, and } from '@tanstack/db'

function TodoList() {
  const [userId, setUserId] = createSignal(1)
  const [status, setStatus] = createSignal('active')

  // Solid automatically tracks userId() and status() calls
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => and(
       eq(todos.userId, userId()),
       eq(todos.status, status())
     ))
  )

  return (
    <div>
      <select onChange={(e) => setStatus(e.currentTarget.value)}>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      <div>{query().length} todos</div>
    </div>
  )
}
```

**Key Point:** Unlike React, you don't need dependency arrays. Solid's reactive system automatically tracks any signals, props, or stores accessed during query execution.

#### Best Practices

**Access signals inside the query function:**

```tsx
import { createSignal } from 'solid-js'
import { useLiveQuery } from '@tanstack/solid-db'
import { gt } from '@tanstack/db'

function TodoList() {
  const [minPriority, setMinPriority] = createSignal(5)

  // Good - signal accessed inside query function
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => gt(todos.priority, minPriority()))
  )

  // Solid automatically tracks minPriority() and recomputes when it changes
  return <div>{query().length} todos</div>
}
```

**Don't read signals outside the query function:**

```tsx
import { createSignal } from 'solid-js'
import { useLiveQuery } from '@tanstack/solid-db'
import { gt } from '@tanstack/db'

function TodoList() {
  const [minPriority, setMinPriority] = createSignal(5)

  // Bad - reading signal outside query function
  const currentPriority = minPriority()
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
     .where(({ todos }) => gt(todos.priority, currentPriority))
  )
  // Won't update when minPriority changes! In development, Solid 2 also
  // warns about this untracked read in the component body.

  return <div>{query().length} todos</div>
}
```

**Static queries need no special handling:**

```tsx
import { useLiveQuery } from '@tanstack/solid-db'

function AllTodos() {
  // No signals accessed - query never changes
  const query = useLiveQuery((q) =>
    q.from({ todos: todosCollection })
  )

  return <div>{query().length} todos</div>
}
```

### Using Pre-created Collections

You can also pass an existing collection to `useLiveQuery`. This is useful for sharing queries across components:

```tsx
import { createLiveQueryCollection, eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/solid-db'

// Create collection outside component
const todosQuery = createLiveQueryCollection((q) =>
  q.from({ todos: todosCollection })
   .where(({ todos }) => eq(todos.active, true))
)

function TodoList() {
  // Pass existing collection
  const query = useLiveQuery(() => todosQuery)

  return <div>{query().length} todos</div>
}
```
