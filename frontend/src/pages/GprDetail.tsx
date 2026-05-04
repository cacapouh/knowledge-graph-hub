import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type {
  GraphPullRequest,
  ObjectType,
  LinkType,
  ObjectInstance,
  LinkInstance,
} from '../api/types'
import DiffGraph from '../components/DiffGraph'
import { ArrowLeft, Check, X, Undo2, AlertTriangle, CheckCircle2, GitPullRequest, Clock } from 'lucide-react'

export default function GprDetail() {
  const { id } = useParams()
  const gprId = Number(id)
  const queryClient = useQueryClient()

  const { data: gpr, isLoading } = useQuery({
    queryKey: ['gpr', gprId],
    queryFn: () => api.get<GraphPullRequest>(`/gpr/${gprId}`),
    refetchInterval: 3000,
    enabled: !Number.isNaN(gprId),
  })

  const { data: objectTypes = [] } = useQuery({
    queryKey: ['objectTypes'],
    queryFn: () => api.get<ObjectType[]>('/ontology/object-types'),
  })

  const { data: linkTypes = [] } = useQuery({
    queryKey: ['linkTypes'],
    queryFn: () => api.get<LinkType[]>('/ontology/link-types'),
  })

  // Collect impacted object/link IDs from operations.
  const { impactedObjectIds, needLinks } = useMemo(() => {
    const objIds = new Set<number>()
    let needLinks = false
    if (!gpr) return { impactedObjectIds: objIds, needLinks }
    for (const op of gpr.operations) {
      if (op.op === 'update_object' || op.op === 'delete_object') objIds.add(op.object_id)
      if (op.op === 'create_link') {
        if (typeof op.source.object_id === 'number') objIds.add(op.source.object_id)
        if (typeof op.target.object_id === 'number') objIds.add(op.target.object_id)
      }
      if (op.op === 'delete_link') needLinks = true
    }
    return { impactedObjectIds: objIds, needLinks }
  }, [gpr])

  // Fetch the impacted object instances individually (small N).
  const { data: objects = [] } = useQuery({
    queryKey: ['gpr-impacted-objects', gprId, [...impactedObjectIds].sort()],
    enabled: impactedObjectIds.size > 0,
    queryFn: async () => {
      const ids = [...impactedObjectIds]
      const results = await Promise.all(
        ids.map(async (oid) => {
          try {
            return await api.get<ObjectInstance>(`/ontology/objects/${oid}`)
          } catch {
            return null
          }
        }),
      )
      return results.filter((o): o is ObjectInstance => o !== null)
    },
  })

  // For delete_link / general context we may need the full link list (small dataset).
  const { data: allLinks = [] } = useQuery({
    queryKey: ['all-links-for-gpr'],
    enabled: needLinks || impactedObjectIds.size > 0,
    queryFn: () => api.get<LinkInstance[]>('/ontology/links?limit=10000'),
  })

  // Filter links: those touching impacted objects, plus those targeted by delete_link.
  const relevantLinks = useMemo(() => {
    if (!gpr) return [] as LinkInstance[]
    const deleteIds = new Set<number>()
    for (const op of gpr.operations) {
      if (op.op === 'delete_link') deleteIds.add(op.link_id)
    }
    return allLinks.filter(
      (l) =>
        deleteIds.has(l.id) ||
        impactedObjectIds.has(l.source_object_id) ||
        impactedObjectIds.has(l.target_object_id),
    )
  }, [allLinks, impactedObjectIds, gpr])

  const applyMut = useMutation({
    mutationFn: () => api.post<GraphPullRequest>(`/gpr/${gprId}/apply`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gpr', gprId] })
      queryClient.invalidateQueries({ queryKey: ['gpr-list'] })
    },
  })
  const closeMut = useMutation({
    mutationFn: () => api.post<GraphPullRequest>(`/gpr/${gprId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gpr', gprId] })
      queryClient.invalidateQueries({ queryKey: ['gpr-list'] })
    },
  })
  const revertMut = useMutation({
    mutationFn: () => api.post<GraphPullRequest>(`/gpr/${gprId}/revert`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gpr', gprId] })
      queryClient.invalidateQueries({ queryKey: ['gpr-list'] })
    },
  })

  if (isLoading || !gpr) {
    return (
      <div className="p-6">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <Link to="/gpr" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          一覧へ戻る
        </Link>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={gpr.status} />
              <span className="font-mono text-sm text-gray-400">#{gpr.id}</span>
              {gpr.auto_merge && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded">
                  auto-merge
                </span>
              )}
              {gpr.source && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono text-gray-600 bg-gray-100 rounded">
                  {gpr.source}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{gpr.title}</h1>
            {gpr.description && <p className="text-sm text-gray-600 mt-1">{gpr.description}</p>}
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              created {new Date(gpr.created_at).toLocaleString('ja-JP')}
              {gpr.applied_at && <> · applied {new Date(gpr.applied_at).toLocaleString('ja-JP')}</>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {gpr.status === 'open' && (
              <>
                <button
                  type="button"
                  onClick={() => applyMut.mutate()}
                  disabled={applyMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve & Apply
                </button>
                <button
                  type="button"
                  onClick={() => closeMut.mutate()}
                  disabled={closeMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </>
            )}
            {gpr.status === 'merged' && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('この GPR をロールバックしますか?')) revertMut.mutate()
                }}
                disabled={revertMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-700 bg-white border border-rose-300 rounded-lg hover:bg-rose-50 disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" />
                Revert
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Diff graph */}
      <div className="flex-1 p-3 bg-gray-100 overflow-hidden">
        <DiffGraph
          gpr={gpr}
          objectTypes={objectTypes}
          linkTypes={linkTypes}
          objects={objects}
          links={relevantLinks}
        />
      </div>

      {/* Apply log (collapsible-feel block) */}
      {gpr.apply_log.length > 0 && (
        <div className="border-t border-gray-200 bg-white px-6 py-3 max-h-[40vh] overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Apply Log</h2>
          <div className="space-y-1.5 font-mono text-xs">
            {gpr.apply_log.map((entry, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 px-2 py-1.5 rounded ${
                  entry.ok === false ? 'bg-rose-50 border border-rose-200' : 'bg-gray-50'
                }`}
              >
                <span className="text-gray-400 shrink-0">[{entry.index ?? i}]</span>
                <span className={`shrink-0 font-bold ${entry.ok === false ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {entry.ok === false ? 'ERR' : 'OK '}
                </span>
                <span className="text-gray-600 truncate flex-1">
                  {entry.error
                    ? entry.error
                    : `${(entry.op as { op?: string })?.op ?? '?'} → ${
                        entry.created_object_id !== undefined
                          ? `obj #${entry.created_object_id}`
                          : entry.created_link_id !== undefined
                          ? `link #${entry.created_link_id}`
                          : entry.updated_object_id !== undefined
                          ? `obj #${entry.updated_object_id} updated`
                          : entry.deleted_object_id !== undefined
                          ? `obj #${entry.deleted_object_id} deleted`
                          : entry.deleted_link_id !== undefined
                          ? `link #${entry.deleted_link_id} deleted`
                          : 'ok'
                      }`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: GraphPullRequest['status'] }) {
  const meta = {
    open:     { label: 'Open',     cls: 'bg-blue-100 text-blue-700 border-blue-200',         icon: GitPullRequest },
    merged:   { label: 'Merged',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    failed:   { label: 'Failed',   cls: 'bg-rose-100 text-rose-700 border-rose-200',         icon: AlertTriangle },
    reverted: { label: 'Reverted', cls: 'bg-gray-100 text-gray-700 border-gray-200',         icon: Undo2 },
    closed:   { label: 'Closed',   cls: 'bg-gray-100 text-gray-500 border-gray-200',         icon: X },
  }[status]
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-full ${meta.cls}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}
