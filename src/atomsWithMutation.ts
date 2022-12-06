import type {
  AnyVariables,
  Client,
  OperationContext,
  OperationResult,
  TypedDocumentNode,
} from '@urql/core'
import { DocumentNode } from 'graphql'
import type { Getter, WritableAtom } from 'jotai/vanilla'
import { makeSubject } from 'wonka'
import type { Subject } from 'wonka'
import { clientAtom } from './clientAtom'
import { createAtoms } from './common'

type Action<Data, Variables extends AnyVariables> = {
  readonly query: DocumentNode | TypedDocumentNode<Data, Variables> | string
  readonly variables: Variables
  readonly context?: Partial<OperationContext>
}

export function atomsWithMutation<Data, Variables extends AnyVariables>(
  getClient: (get: Getter) => Client = (get) => get(clientAtom)
): readonly [
  dataAtom: WritableAtom<
    Data | Promise<Data>,
    [Action<Data, Variables>],
    Promise<OperationResult<Data, Variables>>
  >,
  statusAtom: WritableAtom<
    OperationResult<Data, Variables> | undefined,
    [Action<Data, Variables>],
    Promise<OperationResult<Data, Variables>>
  >
] {
  type Result = OperationResult<Data, Variables>
  const subjectCache = new WeakMap<Client, Subject<Result>>()

  return createAtoms(
    () => {},
    getClient,
    (client) => {
      let subject = subjectCache.get(client)
      if (!subject) {
        subject = makeSubject()
        subjectCache.set(client, subject)
      }
      return subject.source
    },
    async (action, client) => {
      const result = await client
        .mutation(action.query, action.variables, action.context)
        .toPromise()
      const subject = subjectCache.get(client)
      subject?.next(result)
      return result
    }
  )
}
