import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type {
  SavedView,
  ObjectType,
  LinkType,
  ObjectInstance,
  ViewCondition,
} from '../api/types'
import { Plus, Trash2, Pencil, X, ExternalLink, GripVertical } from 'lucide-react'

/** Build the graph URL for a saved view: by ID so the GraphView can apply all conditions. */
function buildGraphUrl(viewId: number): string {
  return `/graph?viewId=${viewId}`
}

type ConditionKind = ViewCondition['kind']

const KIND_LABEL: Record<ConditionKind, string> = {
  type_filter: '種別で絞り込み',
  neighborhood_of_type: 'ノード種別の近傍',
  neighborhood_of_ids: '特定ノードの近傍',
}

const KIND_DESCRIPTION: Record<ConditionKind, string> = {
  type_filter: '選択した種別のノードとエッジをすべて表示',
  neighborhood_of_type: '指定種別のノード全インスタンスから距離 N まで BFS',
  neighborhood_of_ids: '指定したノード ID から距離 N まで BFS',
}

function defaultCondition(kind: ConditionKind): ViewCondition {
  if (kind === 'type_filter') return { kind, object_type_ids: [], link_type_ids: [] }
  if (kind === 'neighborhood_of_type') return { kind, object_type_id: 0, distance: 1 }
  return { kind, object_ids: [], distance: 1 }
}

function isConditionValid(c: ViewCondition): boolean {
  if (c.kind === 'type_filter') return c.object_type_ids.length > 0 || c.link_type_ids.length > 0
  if (c.kind === 'neighborhood_of_type') return c.object_type_id > 0
  return c.object_ids.length > 0
}

export default function SavedViews() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createConditions, setCreateConditions] = useState<ViewCondition[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editConditions, setEditConditions] = useState<ViewCondition[]>([])

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

  const { data: allObjects = [] } = useQuery({
    queryKey: ['allObjects'],
    queryFn: () => api.get<ObjectInstance[]>('/ontology/objects'),
  })

  const objectTypeById = useMemo(
    () => new Map(objectTypes.map((t) => [t.id, t])),
    [objectTypes],
  )

  const labelForObject = (obj: ObjectInstance): string => {
    const ot = objectTypeById.get(obj.object_type_id)
    const titleProp = ot?.title_property
    const props = obj.properties as Record<string, unknown>
    const title =
      (titleProp && props[titleProp] ? String(props[titleProp]) : null) ||
      (props['name'] ? String(props['name']) : null) ||
      (props['hostname'] ? String(props['hostname']) : null)
    return title ? `${title}` : `${ot?.name ?? 'Node'} #${obj.id}`
  }

  const createView = useMutation({
    mutationFn: (data: { name: string; description: string; conditions: ViewCondition[] }) =>
      api.post<SavedView>('/views', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedViews'] })
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      setCreateConditions([])
    },
  })

  const updateView = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; description?: string; conditions?: ViewCondition[] }) =>
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

  const ConditionsEditor = ({
    conditions,
    setConditions,
  }: {
    conditions: ViewCondition[]
    setConditions: (cs: ViewCondition[]) => void
  }) => {
    const replace = (idx: number, next: ViewCondition) =>
      setConditions(conditions.map((c, i) => (i === idx ? next : c)))
    const remove = (idx: number) => setConditions(conditions.filter((_, i) => i !== idx))
    const add = (kind: ConditionKind) => setConditions([...conditions, defaultCondition(kind)])

    return (
      <div className="space-y-2">
        {conditions.length === 0 ? (
          <div className="text-xs text-gray-400 italic px-1">条件をひとつ以上追加してください</div>
        ) : null}
        {conditions.map((cond, idx) => (
          <ConditionCard
            key={idx}
            index={idx}
            condition={cond}
            objectTypes={objectTypes}
            linkTypes={linkTypes}
            allObjects={allObjects}
            labelForObject={labelForObject}
            onChange={(c) => replace(idx, c)}
            onRemove={() => remove(idx)}
          />
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(KIND_LABEL) as ConditionKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => add(k)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-md"
              title={KIND_DESCRIPTION[k]}
            >
              <Plus className="w-3 h-3" />
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const canSave = (name: string, conditions: ViewCondition[]) =>
    name.trim().length > 0 && conditions.length > 0 && conditions.every(isConditionValid)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Views</h1>
          <p className="text-sm text-gray-500 mt-1">
            複数の条件を組み合わせて、関心のあるノード・エッジだけを抽出するビューを作成
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
            <ConditionsEditor conditions={createConditions} setConditions={setCreateConditions} />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  createView.mutate({
                    name: createName,
                    description: createDesc,
                    conditions: createConditions,
                  })
                }
                disabled={!canSave(createName, createConditions)}
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
                  <ConditionsEditor conditions={editConditions} setConditions={setEditConditions} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateView.mutate({
                          id: view.id,
                          name: editName,
                          description: editDesc,
                          conditions: editConditions,
                        })
                      }
                      disabled={!canSave(editName, editConditions)}
                      className="px-3 py-1 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          setEditConditions(view.conditions ?? [])
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                        title="編集"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`「${view.name}」を削除しますか？`)) deleteView.mutate(view.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                        title="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Condition summary */}
                  <div className="mt-2 space-y-1">
                    {(view.conditions ?? []).map((c, i) => (
                      <ConditionSummary
                        key={i}
                        condition={c}
                        objectTypes={objectTypes}
                        linkTypes={linkTypes}
                        allObjects={allObjects}
                        labelForObject={labelForObject}
                      />
                    ))}
                  </div>
                  {/* Graph link */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Link
                      to={buildGraphUrl(view.id)}
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

// ─────────────────────────────────────────────────────────────────
// Condition card (editor)
// ─────────────────────────────────────────────────────────────────

function ConditionCard({
  index,
  condition,
  objectTypes,
  linkTypes,
  allObjects,
  labelForObject,
  onChange,
  onRemove,
}: {
  index: number
  condition: ViewCondition
  objectTypes: ObjectType[]
  linkTypes: LinkType[]
  allObjects: ObjectInstance[]
  labelForObject: (obj: ObjectInstance) => string
  onChange: (next: ViewCondition) => void
  onRemove: () => void
}) {
  const uniqueLinkTypes = useMemo(() => {
    const seen = new Set<string>()
    return linkTypes.filter((lt) => {
      if (seen.has(lt.name)) return false
      seen.add(lt.name)
      return true
    })
  }, [linkTypes])

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <GripVertical className="w-3.5 h-3.5 text-gray-300" />
          <span className="font-semibold">#{index + 1}</span>
          <span>·</span>
          <span className="font-medium text-gray-700">{KIND_LABEL[condition.kind]}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
          title="この条件を削除"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {condition.kind === 'type_filter' && (
        <TypeFilterEditor
          condition={condition}
          objectTypes={objectTypes}
          uniqueLinkTypes={uniqueLinkTypes}
          linkTypes={linkTypes}
          onChange={onChange}
        />
      )}
      {condition.kind === 'neighborhood_of_type' && (
        <NeighborhoodOfTypeEditor
          condition={condition}
          objectTypes={objectTypes}
          onChange={onChange}
        />
      )}
      {condition.kind === 'neighborhood_of_ids' && (
        <NeighborhoodOfIdsEditor
          condition={condition}
          allObjects={allObjects}
          labelForObject={labelForObject}
          onChange={onChange}
        />
      )}
    </div>
  )
}

function TypeFilterEditor({
  condition,
  objectTypes,
  uniqueLinkTypes,
  linkTypes,
  onChange,
}: {
  condition: { kind: 'type_filter'; object_type_ids: number[]; link_type_ids: number[] }
  objectTypes: ObjectType[]
  uniqueLinkTypes: LinkType[]
  linkTypes: LinkType[]
  onChange: (next: ViewCondition) => void
}) {
  const selectedNode = new Set(condition.object_type_ids)
  const selectedLink = new Set(condition.link_type_ids)

  const toggleNode = (id: number) => {
    const next = new Set(selectedNode)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ ...condition, object_type_ids: [...next] })
  }
  const linkIdsByName = (name: string) => linkTypes.filter((lt) => lt.name === name).map((lt) => lt.id)
  const hasLinkName = (name: string) => linkIdsByName(name).some((id) => selectedLink.has(id))
  const toggleLinkName = (name: string) => {
    const ids = linkIdsByName(name)
    const next = new Set(selectedLink)
    if (ids.some((id) => next.has(id))) ids.forEach((id) => next.delete(id))
    else ids.forEach((id) => next.add(id))
    onChange({ ...condition, link_type_ids: [...next] })
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ノード種別</div>
        <div className="flex flex-wrap gap-1.5">
          {objectTypes.map((ot) => (
            <button
              type="button"
              key={ot.id}
              onClick={() => toggleNode(ot.id)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors border ${
                selectedNode.has(ot.id)
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              style={selectedNode.has(ot.id) ? { backgroundColor: ot.color } : undefined}
            >
              {ot.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">エッジ種別</div>
        <div className="flex flex-wrap gap-1.5">
          {uniqueLinkTypes.map((lt) => (
            <button
              type="button"
              key={lt.id}
              onClick={() => toggleLinkName(lt.name)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors border ${
                hasLinkName(lt.name)
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
}

function NeighborhoodOfTypeEditor({
  condition,
  objectTypes,
  onChange,
}: {
  condition: { kind: 'neighborhood_of_type'; object_type_id: number; distance: number }
  objectTypes: ObjectType[]
  onChange: (next: ViewCondition) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">起点ノード種別</div>
        <div className="flex flex-wrap gap-1.5">
          {objectTypes.map((ot) => (
            <button
              type="button"
              key={ot.id}
              onClick={() => onChange({ ...condition, object_type_id: ot.id })}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors border ${
                condition.object_type_id === ot.id
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              style={condition.object_type_id === ot.id ? { backgroundColor: ot.color } : undefined}
            >
              {ot.name}
            </button>
          ))}
        </div>
      </div>
      <DistanceSlider
        distance={condition.distance}
        onChange={(d) => onChange({ ...condition, distance: d })}
      />
    </div>
  )
}

function NeighborhoodOfIdsEditor({
  condition,
  allObjects,
  labelForObject,
  onChange,
}: {
  condition: { kind: 'neighborhood_of_ids'; object_ids: number[]; distance: number }
  allObjects: ObjectInstance[]
  labelForObject: (obj: ObjectInstance) => string
  onChange: (next: ViewCondition) => void
}) {
  const [search, setSearch] = useState('')
  const selected = new Set(condition.object_ids)
  const objectsById = useMemo(() => new Map(allObjects.map((o) => [o.id, o])), [allObjects])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return [] as ObjectInstance[]
    return allObjects
      .filter((o) => !selected.has(o.id))
      .filter((o) => {
        const label = labelForObject(o).toLowerCase()
        return label.includes(q) || String(o.id) === q
      })
      .slice(0, 10)
  }, [search, allObjects, selected, labelForObject])

  const addId = (id: number) => {
    if (selected.has(id)) return
    onChange({ ...condition, object_ids: [...condition.object_ids, id] })
    setSearch('')
  }
  const removeId = (id: number) => {
    onChange({ ...condition, object_ids: condition.object_ids.filter((x) => x !== id) })
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">起点ノード</div>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {condition.object_ids.map((id) => {
            const obj = objectsById.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-md text-xs"
              >
                {obj ? labelForObject(obj) : `#${id}`}
                <button
                  type="button"
                  onClick={() => removeId(id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ノード名または ID で検索"
            className="w-full px-2.5 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          {matches.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 z-10 bg-white border border-gray-200 rounded-md shadow-sm max-h-48 overflow-auto">
              {matches.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => addId(o.id)}
                  className="block w-full text-left px-2 py-1 text-xs hover:bg-brand-50"
                >
                  {labelForObject(o)} <span className="text-gray-400">#{o.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <DistanceSlider
        distance={condition.distance}
        onChange={(d) => onChange({ ...condition, distance: d })}
      />
    </div>
  )
}

function DistanceSlider({ distance, onChange }: { distance: number; onChange: (d: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">距離</span>
      {[1, 2, 3, 4, 5].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`w-7 h-6 text-xs rounded-md border transition-colors ${
            distance === d
              ? 'bg-brand-600 text-white border-transparent'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Condition summary (read-only badge)
// ─────────────────────────────────────────────────────────────────

function ConditionSummary({
  condition,
  objectTypes,
  linkTypes,
  allObjects,
  labelForObject,
}: {
  condition: ViewCondition
  objectTypes: ObjectType[]
  linkTypes: LinkType[]
  allObjects: ObjectInstance[]
  labelForObject: (obj: ObjectInstance) => string
}) {
  if (condition.kind === 'type_filter') {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 rounded">
          種別フィルタ
        </span>
        {condition.object_type_ids.map((tid) => {
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
        {[...new Set(condition.link_type_ids.map((lid) => linkTypes.find((l) => l.id === lid)?.name).filter(Boolean))].map((name) => (
          <span
            key={`lt-${name}`}
            className="px-2 py-0.5 text-[10px] font-medium text-white bg-gray-600 rounded-full"
          >
            {name as string}
          </span>
        ))}
      </div>
    )
  }
  if (condition.kind === 'neighborhood_of_type') {
    const ot = objectTypes.find((o) => o.id === condition.object_type_id)
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded">
          種別近傍 (d={condition.distance})
        </span>
        {ot ? (
          <span
            className="px-2 py-0.5 text-[10px] font-medium text-white rounded-full"
            style={{ backgroundColor: ot.color }}
          >
            {ot.name}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">(種別未選択)</span>
        )}
      </div>
    )
  }
  // neighborhood_of_ids
  const objectsById = new Map(allObjects.map((o) => [o.id, o]))
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 rounded">
        ノード近傍 (d={condition.distance})
      </span>
      {condition.object_ids.slice(0, 5).map((id) => {
        const obj = objectsById.get(id)
        return (
          <span
            key={id}
            className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-200"
          >
            {obj ? labelForObject(obj) : `#${id}`}
          </span>
        )
      })}
      {condition.object_ids.length > 5 && (
        <span className="text-[10px] text-gray-400">+{condition.object_ids.length - 5}</span>
      )}
    </div>
  )
}
