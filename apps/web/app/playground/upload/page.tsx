import { redirect } from 'next/navigation'

import { toQueryString, type SearchParams } from '../_lib/query-string'

export default function PlaygroundUploadRedirectPage({ searchParams }: { searchParams: SearchParams }) {
  const qs = toQueryString(searchParams, new Set(['demo']))
  redirect(`/playground/skill-scan${qs}`)
}
