import { ReactNode } from 'react'

const URL_RE = /https?:\/\/[^\s]+/g

export function textWithLinks(text: string): ReactNode {
  const parts: (string | { url: string })[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push({ url: m[0] })
    lastIndex = URL_RE.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  if (parts.length === 1 && typeof parts[0] === 'string') return <>{text}</>
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-brand-600 underline hover:text-brand-800 break-all"
          >
            {p.url}
          </a>
        ),
      )}
    </>
  )
}

export function renderPropValue(s: string): ReactNode {
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        const items = parsed.map(String)
        if (items.length === 0) return <span className="text-gray-400">—</span>
        return (
          <div className="space-y-1">
            {items.map((item, i) => <div key={i}>{textWithLinks(item)}</div>)}
          </div>
        )
      }
    } catch { /* not JSON */ }
  }
  return textWithLinks(s)
}
