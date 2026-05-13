import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { GraphPullRequest, GprStatus } from '../api/types'
import { GitPullRequest, CheckCircle2, AlertTriangle, Undo2, X } from 'lucide-react'

const STATUS_META: Record<GprStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  open:     { label: 'Open',     cls: 'bg-blue-100 text-blue-700 border-blue-200',         icon: GitPullRequest },
  merged:   { label: 'Merged',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed:   { label: 'Failed',   cls: 'bg-rose-100 text-rose-700 border-rose-200',         icon: AlertTriangle },
  reverted: { label: 'Reverted', cls: 'bg-gray-100 text-gray-700 border-gray-200',         icon: Undo2 },
  closed:   { label: 'Closed',   cls: 'bg-gray-100 text-gray-500 border-gray-200',         icon: X },
}

export default function GprList() {
  const { data: gprs = [], isLoading } = useQuery({
    queryKey: ['gpr-list'],
    queryFn: () => api.get<GraphPullRequest[]>('/gpr'),
    refetchInterval: 5000,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitPullRequest className="w-6 h-6 text-brand-600" />
          Graph Pull Requests
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          AI などからの提案差分。差分を確認して Approve / Close、適用後は Revert もできる。
        </p>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">読み込み中...</div>
      ) : gprs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GitPullRequest className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <div className="font-medium text-gray-600">まだ GPR がありません</div>
          <div className="text-sm mt-1">MCP の <code>propose_graph_changes</code> から作成できます</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {gprs.map((gpr) => {
            const meta = STATUS_META[gpr.status]
            const Icon = meta.icon
            const opCount = gpr.operations.length
            return (
              <Link
                key={gpr.id}
                to={`/gpr/${gpr.id}`}
                className="block bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-full ${meta.cls}`}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                  <span className="font-mono text-xs text-gray-400">#{gpr.id}</span>
                  <span className="font-semibold text-gray-900 truncate flex-1">{gpr.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {opCount} op{opCount === 1 ? '' : 's'}
                  </span>
                </div>
                {(gpr.source || gpr.description) && (
                  <div className="mt-1 ml-[78px] text-xs text-gray-500 truncate">
                    {gpr.source && <span className="font-mono mr-2">[{gpr.source}]</span>}
                    {gpr.description}
                  </div>
                )}
                <div className="mt-1 ml-[78px] text-[11px] text-gray-400">
                  {gpr.applied_at
                    ? `applied ${new Date(gpr.applied_at).toLocaleString('ja-JP')}`
                    : `created ${new Date(gpr.created_at).toLocaleString('ja-JP')}`}
                  {gpr.auto_merge && <span className="ml-2 text-amber-600">auto-merge</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
