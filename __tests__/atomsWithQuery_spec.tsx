import React, { Component, StrictMode, Suspense } from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import type { Client } from '@urql/core'
import { useAtom, useSetAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { delay, makeSubject, map, pipe } from 'wonka'
import type { Source } from 'wonka'
import { atomsWithQuery } from '../src/index'

const generateClient = (
  source: Source<string | number>,
  error?: () => boolean
) =>
  ({
    query: () =>
      pipe(
        source,
        map((id) =>
          error?.() ? { error: new Error('fetch error') } : { data: { id } }
        ),
        delay(1) // FIXME we want to eliminate this
      ),
  } as unknown as Client)

const generateContinuousClient = (source: Source<number>) =>
  ({
    query: () =>
      pipe(
        source,
        map((i: number) => ({ data: { count: i } }))
      ),
  } as unknown as Client)

it('query basic test', async () => {
  const subject = makeSubject<number>()
  const [countAtom] = atomsWithQuery<{ count: number }, Record<string, never>>(
    '{ count }',
    () => ({}),
    undefined,
    () => generateContinuousClient(subject.source)
  )

  const Counter = () => {
    const [data] = useAtom(countAtom)
    return (
      <>
        <div>count: {data.count}</div>
      </>
    )
  }

  const { findByText } = render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </StrictMode>
  )

  await findByText('loading')
  subject.next(0)
  await findByText('count: 0')
  subject.next(1)
  await findByText('count: 1')
  subject.next(2)
  await findByText('count: 2')
})

it('query dependency test', async () => {
  type Update = (prev: number) => number
  const dummyAtom = atom(10)
  const setDummyAtom = atom(null, (_get, set, update: Update) =>
    set(dummyAtom, update)
  )
  let subject = makeSubject<number>()
  const [countAtom] = atomsWithQuery<{ count: number }, { dummy: number }>(
    '{ count }',
    (get) => ({
      dummy: get(dummyAtom),
    }),
    undefined,
    () => {
      subject = makeSubject<number>()
      return generateContinuousClient(subject.source)
    }
  )

  const Counter = () => {
    const [data] = useAtom(countAtom)
    return (
      <>
        <div>count: {data.count}</div>
      </>
    )
  }

  const Controls = () => {
    const [, setDummy] = useAtom(setDummyAtom)
    return <button onClick={() => setDummy((c) => c + 1)}>dummy</button>
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
      <Controls />
    </StrictMode>
  )

  await findByText('loading')
  subject.next(0)
  await findByText('count: 0')
  subject.next(1)
  await findByText('count: 1')
  subject.next(2)
  await findByText('count: 2')

  fireEvent.click(getByText('dummy'))
  await findByText('loading')
  subject.next(0)
  await findByText('count: 0')
  subject.next(1)
  await findByText('count: 1')
  subject.next(2)
  await findByText('count: 2')
})

it('query change client at runtime', async () => {
  const firstSubject = makeSubject<string>()
  const secondSubject = makeSubject<string>()
  const firstClient = generateClient(firstSubject.source)
  const secondClient = generateClient(secondSubject.source)
  const clientAtom = atom(firstClient)
  const [idAtom] = atomsWithQuery<{ id: string }, Record<string, never>>(
    '{ id }',
    () => ({}),
    undefined,
    (get) => get(clientAtom)
  )

  const Identifier = () => {
    const [data] = useAtom(idAtom)
    return (
      <>
        <div>id: {data.id}</div>
      </>
    )
  }

  const Controls = () => {
    const [, setClient] = useAtom(clientAtom)
    return (
      <>
        <button onClick={() => setClient(firstClient)}>first</button>
        <button onClick={() => setClient(secondClient)}>second</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Suspense fallback="loading">
        <Identifier />
      </Suspense>
      <Controls />
    </StrictMode>
  )

  await findByText('loading')
  firstSubject.next('first')
  await findByText('id: first')

  fireEvent.click(getByText('second'))
  if (process.env.PROVIDER_MODE !== 'VERSIONED_WRITE') {
    // In VERSIONED_WRITE, this check is very unstable
    await findByText('loading')
  }
  secondSubject.next('second')
  await findByText('id: second')

  fireEvent.click(getByText('first'))
  if (process.env.PROVIDER_MODE !== 'VERSIONED_WRITE') {
    // In VERSIONED_WRITE, this check is very unstable
    await findByText('loading')
  }
  firstSubject.next('first')
  await findByText('id: first')
})

it('refetch test', async () => {
  let subject = makeSubject<number>()
  const [countAtom] = atomsWithQuery<{ count: number }, Record<string, never>>(
    '{ count }',
    () => ({}),
    undefined,
    () => {
      subject = makeSubject<number>()
      return generateContinuousClient(subject.source)
    }
  )

  const Counter = () => {
    const [data, dispatch] = useAtom(countAtom)
    return (
      <>
        <div>count: {data.count}</div>
        <button onClick={() => dispatch({ type: 'refetch' })}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </StrictMode>
  )

  await findByText('loading')
  subject.next(0)
  await findByText('count: 0')
  subject.next(1)
  await findByText('count: 1')
  subject.next(2)
  await findByText('count: 2')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  subject.next(0)
  await findByText('count: 0')
  subject.next(1)
  await findByText('count: 1')
  subject.next(2)
  await findByText('count: 2')
})

it('query null client suspense', async () => {
  let subject = makeSubject<string>()
  const clientAtom = atom<Client | null>(null)
  const [, idAtom] = atomsWithQuery<{ id: string }, Record<string, never>>(
    '{ id }',
    () => ({}),
    undefined,
    (get) => get(clientAtom) as Client
  )
  // Derived Atom to safe guard when client is null
  const guardedIdAtom = atom((get) => {
    const client = get(clientAtom)
    if (client === null) return null
    return get(idAtom)
  })

  const Identifier = () => {
    const [result] = useAtom(guardedIdAtom)
    return (
      <>
        <div>{result?.data?.id ?? 'no data'}</div>
      </>
    )
  }

  const Controls = () => {
    const [, setClient] = useAtom(clientAtom)
    return (
      <>
        <button onClick={() => setClient(null)}>unset</button>
        <button
          onClick={() => {
            subject = makeSubject<string>()
            setClient(generateClient(subject.source))
          }}>
          set
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Suspense fallback="loading">
        <Identifier />
      </Suspense>
      <Controls />
    </StrictMode>
  )

  await findByText('no data')

  fireEvent.click(getByText('set'))
  // await findByText('loading')
  subject.next('client is set')
  await findByText('client is set')

  fireEvent.click(getByText('unset'))
  await findByText('no data')

  fireEvent.click(getByText('unset'))
  fireEvent.click(getByText('set'))
  // await findByText('loading')
  subject.next('client is set')
  await findByText('client is set')
})

describe('error handling', () => {
  class ErrorBoundary extends Component<
    { message?: string; retry?: () => void; children: ReactNode },
    { hasError: boolean }
  > {
    constructor(props: { message?: string; children: ReactNode }) {
      super(props)
      this.state = { hasError: false }
    }
    static getDerivedStateFromError() {
      return { hasError: true }
    }
    render() {
      return this.state.hasError ? (
        <div>
          {this.props.message || 'errored'}
          {this.props.retry && (
            <button
              onClick={() => {
                this.props.retry?.()
                this.setState({ hasError: false })
              }}>
              retry
            </button>
          )}
        </div>
      ) : (
        this.props.children
      )
    }
  }

  it('can catch error in error boundary', async () => {
    const subject = makeSubject<number>()
    const client = generateClient(subject.source, () => true)
    const [, countAtom] = atomsWithQuery<{ id: number }, Record<string, never>>(
      '{ id }',
      () => ({}),
      undefined,
      () => client
    )

    const Counter = () => {
      const [result] = useAtom(countAtom)
      if (result?.error) {
        throw result.error
      }
      return <div>count: {result?.data?.id ?? 'no data'}</div>
    }

    const { findByText } = render(
      <ErrorBoundary>
        <Suspense fallback="loading">
          <Counter />
        </Suspense>
      </ErrorBoundary>
    )

    await findByText('count: no data')
    subject.next(0)
    await findByText('errored')
  })

  it('can recover from error', async () => {
    let willThrowError = true
    const subject = makeSubject<number>()
    const client = generateClient(subject.source, () => willThrowError)
    const [, countAtom] = atomsWithQuery<{ id: number }, Record<string, never>>(
      '{ id }',
      () => ({}),
      undefined,
      () => client
    )

    const Counter = () => {
      const [result, dispatch] = useAtom(countAtom)
      const refetch = () => dispatch({ type: 'refetch' })
      if (result?.error) {
        throw result.error
      }
      return (
        <>
          <div>count: {result?.data?.id ?? 'no data'}</div>
          <button onClick={refetch}>refetch</button>
        </>
      )
    }

    const App = () => {
      const dispatch = useSetAtom(countAtom)
      const retry = () => {
        dispatch({ type: 'refetch' })
      }
      return (
        <ErrorBoundary retry={retry}>
          <Suspense fallback="loading">
            <Counter />
          </Suspense>
        </ErrorBoundary>
      )
    }

    const { findByText, getByText } = render(
      <>
        <App />
      </>
    )

    await findByText('count: no data')
    subject.next(0)
    await findByText('errored')

    willThrowError = false
    fireEvent.click(getByText('retry'))
    await findByText('count: no data')
    subject.next(1)
    await findByText('count: 1')

    willThrowError = true
    fireEvent.click(getByText('refetch'))
    await findByText('count: no data')
    subject.next(2)
    await findByText('errored')

    willThrowError = false
    fireEvent.click(getByText('retry'))
    await findByText('count: no data')
    subject.next(3)
    await findByText('count: 3')
  })
})
