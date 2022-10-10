import type { Client, OperationResult } from '@urql/core'
import { atom } from 'jotai'
import type { Getter } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import { filter, pipe, toObservable } from 'wonka'
import type { Source } from 'wonka'

export const createAtoms = <
  Args,
  Result extends OperationResult,
  Action,
  ActionResult extends Promise<void> | void
>(
  getArgs: (get: Getter) => Args,
  getClient: (get: Getter) => Client,
  execute: (client: Client, args: Args) => Source<Result>,
  handleAction: (
    action: Action,
    client: Client,
    refresh: () => void
  ) => ActionResult
) => {
  const refreshAtom = atom(0)

  const sourceAtom = atom((get) => {
    get(refreshAtom)
    const args = getArgs(get)
    const client = getClient(get)
    const source = execute(client, args)
    return source
  })

  const baseStatusAtom = atom((get) => {
    const source = get(sourceAtom)
    const observable = pipe(source, toObservable)
    const resultAtom = atomWithObservable(() => observable)
    return resultAtom
  })

  const statusAtom = atom(
    (get) => {
      const resultAtom = get(baseStatusAtom)
      return get(resultAtom)
    },
    (get, set, action: Action) => {
      const client = getClient(get)
      const refresh = () => {
        set(refreshAtom, (c) => c + 1)
      }
      return handleAction(action, client, refresh)
    }
  )

  const baseDataAtom = atom((get) => {
    const source = get(sourceAtom)
    const observable = pipe(
      source,
      filter((result) => 'data' in result && !result.error),
      toObservable
    )
    const resultAtom = atomWithObservable(() => observable)
    return resultAtom
  })

  const dataAtom = atom(
    (get) => {
      const resultAtom = get(baseDataAtom)
      const result = get(resultAtom)
      if (result.error) {
        throw result.error
      }
      return result.data
    },
    (_get, set, action: Action) => set(statusAtom, action)
  )

  return [dataAtom, statusAtom] as const
}
