import React, { Suspense } from 'react'
import { createClient } from '@urql/core'
import { atomsWithQuery } from 'jotai-urql'
import { useAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'

const client = createClient({ url: 'https://countries.trevorblades.com/' })

const codeAtom = atom('en')

const CODES = [
  'af',
  'am',
  'ar',
  'ay',
  'az',
  'be',
  'bg',
  'bi',
  'bn',
  'bs',
  'ca',
  'ch',
  'cs',
  'da',
  'de',
  'dv',
  'dz',
  'el',
  'en',
  'es',
  'et',
  'eu',
  'fa',
  'ff',
  'fi',
  'fj',
  'fo',
  'fr',
  'ga',
  'gl',
  'gn',
  'gv',
  'he',
  'hi',
  'hr',
  'ht',
  'hu',
  'hy',
  'id',
  'is',
  'it',
  'ja',
  'ka',
  'kg',
  'kk',
  'kl',
  'km',
  'ko',
  'ku',
  'ky',
  'la',
  'lb',
  'ln',
  'lo',
  'lt',
  'lu',
  'lv',
  'mg',
  'mh',
  'mi',
  'mk',
  'mn',
  'ms',
  'mt',
  'my',
  'na',
  'nb',
  'nd',
  'ne',
  'nl',
  'nn',
  'no',
  'nr',
  'ny',
  'oc',
  'pa',
  'pl',
  'ps',
  'pt',
  'qu',
  'rn',
  'ro',
  'ru',
  'rw',
  'sg',
  'si',
  'sk',
  'sl',
  'sm',
  'sn',
  'so',
  'sq',
  'sr',
  'ss',
  'st',
  'sv',
  'sw',
  'ta',
  'tg',
  'th',
  'ti',
  'tk',
  'tn',
  'to',
  'tr',
  'ts',
  'uk',
  'ur',
  'uz',
  've',
  'vi',
  'xh',
  'zh',
  'zu',
]

const [languageAtom] = atomsWithQuery(
  `
query($code: ID!) {
  language(code: $code) {
    code
    name
    native
    rtl
  }
}
`,
  (get) => ({ code: get(codeAtom) }),
  undefined,
  () => client
)

const LanguageData = () => {
  const [data] = useAtom(languageAtom)
  return <pre>{JSON.stringify(data, null, 2)}</pre>
}

const Controls = () => {
  const [code, setCode] = useAtom(codeAtom)
  return (
    <div>
      Code:{' '}
      <select value={code} onChange={(e) => setCode(e.target.value)}>
        {CODES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  )
}

const App = () => (
  <>
    <Controls />
    <Suspense fallback="Loading...">
      <LanguageData />
    </Suspense>
  </>
)

export default App
