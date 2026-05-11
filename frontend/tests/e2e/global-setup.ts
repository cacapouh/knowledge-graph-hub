import { request as pwRequest } from '@playwright/test'

/**
 * Best-effort cleanup of `e2e_*` records left behind by previously-failed runs.
 * Each test cleans up its own data in `finally` blocks, but if the process
 * is killed mid-test that cleanup is skipped — this catches the stragglers.
 */
export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
  const ctx = await pwRequest.newContext({ baseURL })

  const endpoints: Array<{ list: string; del: (id: number) => string; nameField: string }> = [
    { list: '/api/views', del: (id) => `/api/views/${id}`, nameField: 'name' },
    { list: '/api/ontology/object-types', del: (id) => `/api/ontology/object-types/${id}`, nameField: 'name' },
  ]

  for (const ep of endpoints) {
    try {
      const res = await ctx.get(ep.list)
      if (!res.ok()) continue
      const items = (await res.json()) as Array<Record<string, unknown>>
      for (const item of items) {
        const name = String(item[ep.nameField] ?? '')
        const id = item.id as number | undefined
        if (typeof id === 'number' && /^e2e_/i.test(name)) {
          await ctx.delete(ep.del(id)).catch(() => {})
        }
      }
    } catch {
      /* ignore — best effort */
    }
  }

  await ctx.dispose()
}
