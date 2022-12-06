import React, { StrictMode, Suspense } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import type { Client } from '@urql/core'
import { useAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { fromValue, pipe, take, toPromise } from 'wonka'
import { atomsWithMutation } from '../src/index'

const withPromise = (source$: any) => {
  source$.toPromise = () => pipe(source$, take(1), toPromise)
  return source$
}

const generateClient = (error?: () => boolean) =>
  ({
    mutation: () => {
      const source$ = withPromise(
        fromValue(
          error?.()
            ? { error: new Error('fetch error') }
            : { data: { count: 1 } }
        )
      )
      return source$
    },
  } as unknown as Client)

it('mutation basic test', async () => {
  const client = generateClient()
  const [countAtom] = atomsWithMutation<
    { count: number },
    Record<string, never>
  >(() => client)
  const mutateAtom = atom(null, (_get, set) =>
    set(countAtom, { query: 'mutation Test { count }', variables: {} })
  )

  const Counter = () => {
    const [data] = useAtom(countAtom)
    return (
      <>
        <div>count: {data?.count}</div>
      </>
    )
  }

  const Controls = () => {
    const [, mutate] = useAtom(mutateAtom)
    return <button onClick={() => mutate()}>mutate</button>
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

  fireEvent.click(getByText('mutate'))
  await findByText('count: 1')
})

describe('error handling', () => {
  it('mutation error test', async () => {
    const client = generateClient(() => true)
    const [countAtom] = atomsWithMutation<
      { count: number },
      Record<string, never>
    >(() => client)
    const mutateAtom = atom(null, (_get, set) =>
      set(countAtom, { query: 'mutation Test { count }', variables: {} })
    )

    const Counter = () => {
      const [data] = useAtom(countAtom)
      return (
        <>
          <div>count: {data?.count}</div>
        </>
      )
    }

    let errored = false
    const Controls = () => {
      const [, mutate] = useAtom(mutateAtom)
      const handleClick = async () => {
        const result = await mutate()
        if (result.error) {
          errored = true
        }
      }
      return <button onClick={handleClick}>mutate</button>
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

    fireEvent.click(getByText('mutate'))
    await waitFor(() => {
      expect(errored).toBe(true)
    })
  })
})
