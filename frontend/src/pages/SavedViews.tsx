import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SavedView, ObjectType, LinkType } from '../api/types'
import { Plus, Trash2, Eye, Pencil, X, ExternalLink } from 'lucide-react'

/** Build a graph URL with nodeTypes & linkTypes filter params */
function buildGraphUrl(objectTypeIds: number[], linkTypeIds: number[]): string {
  const params = new URLSearchParams()
  if (objectTypeIds.length > 0) params.set('nodeTypes', objectTypeIds.join(','))
  if (linkTypeIds.length > 0) params.set('linkTypes', linkTypeIds.join(','))
  return `/graph?${params.toString()}`
}

export default function SavedViews() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createNodeTypes, setCreateNodeTypes] = useState<Set<number>>(new Set())
  const [createLinkTypes, setCreateLinkTypes] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editNodeTypes, setEditNodeTypes] = useState<Set<number>>(new Set())
  const [editLinkTypes, setEditLinkTypes] = useState<Set<number>>(new Set())

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['savedViews'],
    queryFn: () => api.get<SavedView[]>('/views'),
  })

  const { data: objectTypes = [] } = useQuery({
    queryKey: ['objectTypes'],
    queryFn: () => api.get<ObjectType[]>('/ontology/object-types'),
  })

  const { data: linkTypes = [] } = useQuery({
    queryKey: ['linkTypes'],
    queryFn: () => api.get<LinkType[]>('/ontology/link-types'),
  })

  // Deduplicate link types by name (they can have same name with different IDs)
  const uniqueLinkTypes = linkTypes.reduce<LinkType[]>((acc, lt) => {
    if (!acc.find((a) => a.name === lt.name)) acc.push(lt)
    return acc
  }, [])

  const createView = useMutation({
    mutationFn: (data: { name: string; description: string; object_type_ids: number[]; link_type_ids: number[] }) =>
      api.post<SavedView>('/views', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedViews'] })
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      setCreateNodeTypes(new Set())
      setCreateLinkTypes(new Set())
    },
  })

  const updateView = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; description?: string; object_type_ids?: number[]; link_type_ids?: number[] }) =>
      api.put<SavedView>(`/views/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedViews'] })
      setEditingId(null)
    },
  })

  const deleteView = useMutation({
    mutationFn: (id: number) => api.delete(`/views/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedViews'] }),
  })

  const toggleSet = (set: Set<number>, id: number): Set<number> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }

  // For link types: find all IDs that share a name
  const linkTypeIdsByName = (name: string) => linkTypes.filter((lt) => lt.name === name).map((lt) => lt.id)
  const hasLinkName = (set: Set<number>, name: string) => linkTypeIdsByName(name).some((id) => set.has(id))
  const toggleLinkName = (set: Set<number>, name: string): Set<number> => {
    const ids = linkTypeIdsByName(name)
    const next = new Set(set)
    if (ids.some((id) => next.has(id))) {
      ids.forEach((id) => next.delete(id))
    } else {
      ids.forEach((id) => next.add(id))
    }
    return next
  }

  const TypeSelector = ({
    selectedNodeTypes,
    onToggleNodeType,
    selectedLinkTypes,
    onToggleLinkType,
  }: {
    selectedNodeTypes: Set<number>
    onToggleNodeType: (id: number) => void
    selectedLinkTypes: Set<number>
    onToggleLinkType: (name: string) => void
  }) => (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ノード種別</div>
        <div className="flex flex-wrap gap-1.5">
          {objectTypes.map((ot) => (
            <button
              type="button"
              key={ot.id}
              onClick={() => onToggleNodeType(ot.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                selectedNodeTypes.has(ot.id)
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              style={selectedNodeTypes.has(ot.id) ? { backgroundColor: ot.color } : undefined}
            >
              {ot.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">エッジ種別</div>
        <div className="flex flex-wrap gap-1.5">
          {uniqueLinkTypes.map((lt) => (
            <button
              type="button"
              key={lt.id}
              onClick={() => onToggleLinkType(lt.name)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                hasLinkName(selectedLinkTypes, lt.name)
                  ? 'bg-gray-800 text-white border-transparent'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {lt.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Views</h1>
          <p className="text-sm text-gray-500 mt-1">
            チームごとに関心のあるノード・エッジ種別を選んでカスタムビューを作成
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規ビュー
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">新しいビューを作成</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="ビュー名 (例: Platform Team)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              type="text"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="説明 (任意)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <TypeSelector
              selectedNodeTypes={createNodeTypes}
              onToggleNodeType={(id) => setCreateNodeTypes((prev) => toggleSet(prev, id))}
              selectedLinkTypes={createLinkTypes}
              onToggleLinkType={(name) => setCreateLinkTypes((prev) => toggleLinkName(prev, name))}
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => createView.mutate({
                  name: createName,
                  description: createDesc,
                  object_type_ids: [...createNodeTypes],
                  link_type_ids: [...createLinkTypes],
                })}
                disabled={!createName.trim() || (createNodeTypes.size === 0 && createLinkTypes.size === 0)}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Views list */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">読み込み中...</div>
      ) : views.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-medium text-gray-600">ビューがまだありません</div>
          <div className="text-sm mt-1">「新規ビュー」ボタンから作成してください</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {views.map((view) => (
            <div
              key={view.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 transition-colors"
            >
              {editingId === view.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="説明"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <TypeSelector
                    selectedNodeTypes={editNodeTypes}
                    onToggleNodeType={(id) => setEditNodeTypes((prev) => toggleSet(prev, id))}
                    selectedLinkTypes={editLinkTypes}
                    onToggleLinkType={(name) => setEditLinkTypes((prev) => toggleLinkName(prev, name))}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateView.mutate({
                        id: view.id,
                        name: editName,
                        description: editDesc,
                        object_type_ids: [...editNodeTypes],
                        link_type_ids: [...editLinkTypes],
                      })}
                      className="px-3 py-1 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{view.name}</h3>
                      {view.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{view.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => {
                          setEditingId(view.id)
                          setEditName(view.name)
                          setEditDesc(view.description)
                          setEditNodeTypes(new Set(view.object_type_ids))
                          setEditLinkTypes(new Set(view.link_type_ids))
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                        title="編集"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`「${view.name}」を削除しますか？`)) deleteView.mutate(view.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                        title="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Type tags */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {view.object_type_ids.map((tid) => {
                      const ot = objectTypes.find((o) => o.id === tid)
                      return ot ? (
                        <span
                          key={`ot-${tid}`}
                          className="px-2 py-0.5 text-[10px] font-medium text-white rounded-full"
                          style={{ backgroundColor: ot.color }}
                        >
                          {ot.name}
                        </span>
                      ) : null
                    })}
                    {[...new Set(view.link_type_ids.map((lid) => linkTypes.find((l) => l.id === lid)?.name).filter(Boolean))].map((name) => (
                      <span
                        key={`lt-${name}`}
                        className="px-2 py-0.5 text-[10px] font-medium text-white bg-gray-600 rounded-full"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  {/* Graph link */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Link
                      to={buildGraphUrl(view.object_type_ids, view.link_type_ids)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Graph で開く
                    </Link>
                    <span className="ml-3 text-xs text-gray-400">
                      更新: {new Date(view.updated_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
