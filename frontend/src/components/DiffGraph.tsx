import { useMemo, memo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
  NodeProps,
  Handle,
  Position,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type {
  GraphPullRequest,
  GprOperation,
  ObjectType,
  ObjectInstance,
  LinkType,
  LinkInstance,
} from '../api/types'

type DiffStatus = 'unchanged' | 'created' | 'updated' | 'deleted'

interface DiffNodeData {
  label: string
  typeName: string
  color: string
  status: DiffStatus
  properties: Record<string, unknown>
  priorProperties?: Record<string, unknown>
}

const STATUS_BORDER: Record<DiffStatus, string> = {
  unchanged: 'border-gray-300',
  created: 'border-emerald-500',
  updated: 'border-amber-500',
  deleted: 'border-rose-500',
}

const STATUS_LABEL: Record<DiffStatus, string | null> = {
  unchanged: null,
  created: '+ NEW',
  updated: '~ UPDATED',
  deleted: '- DELETED',
}

const STATUS_LABEL_BG: Record<DiffStatus, string> = {
  unchanged: '',
  created: 'bg-emerald-500',
  updated: 'bg-amber-500',
  deleted: 'bg-rose-500',
}

const DiffNode = memo(function DiffNode({ data }: NodeProps<DiffNodeData>) {
  const { label, typeName, color, status, properties } = data
  const stripe = STATUS_LABEL[status]
  const isDeleted = status === 'deleted'
  return (
    <div
      className={`rounded-xl border-2 min-w-[180px] max-w-[260px] bg-white shadow-md ${STATUS_BORDER[status]} ${
        isDeleted ? 'opacity-60' : ''
      }`}
      style={{ borderStyle: isDeleted ? 'dashed' : 'solid' }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
      {stripe && (
        <div className={`px-2 py-0.5 rounded-t-[8px] text-white text-[10px] font-bold tracking-wider ${STATUS_LABEL_BG[status]}`}>
          {stripe}
        </div>
      )}
      <div
        className="px-3 py-1.5 text-white text-xs font-bold tracking-wide"
        style={{ backgroundColor: color, borderTopLeftRadius: stripe ? 0 : 10, borderTopRightRadius: stripe ? 0 : 10 }}
      >
        <span className="opacity-80">{typeName}</span>
      </div>
      <div className="px-3 py-2">
        <div className={`font-semibold text-sm text-gray-900 truncate ${isDeleted ? 'line-through' : ''}`}>
          {label}
        </div>
        {Object.entries(properties).slice(0, 3).map(([k, v]) => (
          <div key={k} className="flex text-[11px] text-gray-500 gap-1 mt-0.5">
            <span className="font-medium text-gray-600 shrink-0">{k}:</span>
            <span className="truncate">{String(v)}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
    </div>
  )
})

const nodeTypes = { diffNode: DiffNode }

const STATUS_EDGE_COLOR: Record<DiffStatus, string> = {
  unchanged: '#9ca3af',
  created: '#10b981',
  updated: '#f59e0b',
  deleted: '#ef4444',
}

interface NodeRecord {
  // unified key — object_id (string) for existing, "client:<id>" for new
  key: string
  objectTypeId: number | null  // null if cannot resolve (new object with bad type)
  typeName: string
  color: string
  label: string
  properties: Record<string, unknown>
  priorProperties?: Record<string, unknown>
  status: DiffStatus
}

interface EdgeRecord {
  key: string
  sourceKey: string
  targetKey: string
  linkTypeId: number | null
  label: string
  status: DiffStatus
}

function objectKey(id: number): string {
  return `o:${id}`
}

function clientKey(cid: string): string {
  return `c:${cid}`
}

function endpointKey(spec: { object_id?: number; client_id?: string }): string | null {
  if (typeof spec.object_id === 'number') return objectKey(spec.object_id)
  if (typeof spec.client_id === 'string') return clientKey(spec.client_id)
  return null
}

function resolveObjectType(
  ref: string | number,
  byId: Map<number, ObjectType>,
  byApi: Map<string, ObjectType>,
): ObjectType | undefined {
  if (typeof ref === 'number') return byId.get(ref)
  return byApi.get(ref)
}

function resolveLinkType(
  ref: string | number,
  byId: Map<number, LinkType>,
  byApi: Map<string, LinkType>,
): LinkType | undefined {
  if (typeof ref === 'number') return byId.get(ref)
  return byApi.get(ref)
}

function pickLabel(props: Record<string, unknown>): string {
  for (const k of ['name', 'title', 'hostname', 'label', 'id']) {
    const v = props[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  const first = Object.entries(props)[0]
  return first ? `${first[0]}=${first[1]}` : '(empty)'
}

interface BuildResult {
  beforeNodes: NodeRecord[]
  beforeEdges: EdgeRecord[]
  afterNodes: NodeRecord[]
  afterEdges: EdgeRecord[]
}

/**
 * Compute the impacted-graph diff. Only objects/links touched by the GPR
 * (plus the endpoints of new links) are included.
 */
function buildDiff(
  ops: GprOperation[],
  objects: Map<number, ObjectInstance>,
  links: Map<number, LinkInstance>,
  objectTypeById: Map<number, ObjectType>,
  objectTypeByApi: Map<string, ObjectType>,
  linkTypeById: Map<number, LinkType>,
  linkTypeByApi: Map<string, LinkType>,
): BuildResult {
  // ── Collect "before" ─────────────────────────────────
  const beforeNodes = new Map<string, NodeRecord>()
  const beforeEdges = new Map<string, EdgeRecord>()

  const addBeforeObject = (oid: number) => {
    const k = objectKey(oid)
    if (beforeNodes.has(k)) return
    const obj = objects.get(oid)
    if (!obj) return
    const ot = objectTypeById.get(obj.object_type_id)
    beforeNodes.set(k, {
      key: k,
      objectTypeId: obj.object_type_id,
      typeName: ot?.name ?? `Type#${obj.object_type_id}`,
      color: ot?.color ?? '#6b7280',
      label: pickLabel(obj.properties),
      properties: obj.properties,
      status: 'unchanged',
    })
  }

  const addBeforeLink = (lid: number) => {
    const k = `l:${lid}`
    if (beforeEdges.has(k)) return
    const link = links.get(lid)
    if (!link) return
    const lt = linkTypeById.get(link.link_type_id)
    addBeforeObject(link.source_object_id)
    addBeforeObject(link.target_object_id)
    beforeEdges.set(k, {
      key: k,
      sourceKey: objectKey(link.source_object_id),
      targetKey: objectKey(link.target_object_id),
      linkTypeId: link.link_type_id,
      label: lt?.name ?? `Link#${link.link_type_id}`,
      status: 'unchanged',
    })
  }

  // Seed before-graph from ops touching existing entities
  for (const op of ops) {
    switch (op.op) {
      case 'update_object':
      case 'delete_object':
        addBeforeObject(op.object_id)
        break
      case 'delete_link':
        addBeforeLink(op.link_id)
        break
      case 'create_link': {
        if (typeof op.source.object_id === 'number') addBeforeObject(op.source.object_id)
        if (typeof op.target.object_id === 'number') addBeforeObject(op.target.object_id)
        break
      }
    }
  }

  // ── Build "after" by simulating ops on top of before ───
  const afterNodes = new Map<string, NodeRecord>()
  const afterEdges = new Map<string, EdgeRecord>()
  for (const [k, v] of beforeNodes) afterNodes.set(k, { ...v })
  for (const [k, v] of beforeEdges) afterEdges.set(k, { ...v })

  let virtualLinkSeq = 0
  for (const op of ops) {
    switch (op.op) {
      case 'create_object': {
        const ot = resolveObjectType(op.object_type, objectTypeById, objectTypeByApi)
        const k = op.client_id ? clientKey(op.client_id) : `new:${Math.random().toString(36).slice(2)}`
        afterNodes.set(k, {
          key: k,
          objectTypeId: ot?.id ?? null,
          typeName: ot?.name ?? String(op.object_type),
          color: ot?.color ?? '#10b981',
          label: pickLabel(op.properties),
          properties: op.properties,
          status: 'created',
        })
        break
      }
      case 'update_object': {
        const k = objectKey(op.object_id)
        const existing = afterNodes.get(k)
        if (existing) {
          afterNodes.set(k, {
            ...existing,
            label: pickLabel(op.properties),
            priorProperties: existing.properties,
            properties: op.properties,
            status: 'updated',
          })
        }
        break
      }
      case 'delete_object': {
        const k = objectKey(op.object_id)
        const existing = afterNodes.get(k)
        if (existing) afterNodes.set(k, { ...existing, status: 'deleted' })
        break
      }
      case 'create_link': {
        const lt = resolveLinkType(op.link_type, linkTypeById, linkTypeByApi)
        const sk = endpointKey(op.source)
        const tk = endpointKey(op.target)
        if (!sk || !tk) break
        const ek = `new-link:${virtualLinkSeq++}`
        afterEdges.set(ek, {
          key: ek,
          sourceKey: sk,
          targetKey: tk,
          linkTypeId: lt?.id ?? null,
          label: lt?.name ?? String(op.link_type),
          status: 'created',
        })
        break
      }
      case 'delete_link': {
        const k = `l:${op.link_id}`
        const existing = afterEdges.get(k)
        if (existing) afterEdges.set(k, { ...existing, status: 'deleted' })
        break
      }
    }
  }

  return {
    beforeNodes: Array.from(beforeNodes.values()),
    beforeEdges: Array.from(beforeEdges.values()),
    afterNodes: Array.from(afterNodes.values()),
    afterEdges: Array.from(afterEdges.values()),
  }
}

/**
 * Trivial layout: arrange nodes in a vertical grid. Stable across re-renders
 * because we sort by key.
 */
function layoutNodes(records: NodeRecord[]): Node[] {
  const sorted = [...records].sort((a, b) => a.key.localeCompare(b.key))
  return sorted.map((r, i) => ({
    id: r.key,
    type: 'diffNode',
    position: { x: 60 + (i % 2) * 280, y: 40 + Math.floor(i / 2) * 180 },
    data: {
      label: r.label,
      typeName: r.typeName,
      color: r.color,
      status: r.status,
      properties: r.properties,
      priorProperties: r.priorProperties,
    },
  }))
}

function layoutEdges(records: EdgeRecord[]): Edge[] {
  return records.map((r) => ({
    id: r.key,
    source: r.sourceKey,
    target: r.targetKey,
    label: r.label,
    type: 'smoothstep',
    animated: r.status === 'created',
    style: {
      stroke: STATUS_EDGE_COLOR[r.status],
      strokeWidth: r.status === 'unchanged' ? 1.5 : 2.5,
      strokeDasharray: r.status === 'deleted' ? '6 4' : undefined,
    },
    labelStyle: { fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: STATUS_EDGE_COLOR[r.status] },
  }))
}

interface DiffGraphProps {
  gpr: GraphPullRequest
  objectTypes: ObjectType[]
  linkTypes: LinkType[]
  objects: ObjectInstance[]
  links: LinkInstance[]
}

export default function DiffGraph({ gpr, objectTypes, linkTypes, objects, links }: DiffGraphProps) {
  const objectTypeById = useMemo(() => new Map(objectTypes.map((t) => [t.id, t])), [objectTypes])
  const objectTypeByApi = useMemo(() => new Map(objectTypes.map((t) => [t.api_name, t])), [objectTypes])
  const linkTypeById = useMemo(() => new Map(linkTypes.map((t) => [t.id, t])), [linkTypes])
  const linkTypeByApi = useMemo(() => new Map(linkTypes.map((t) => [t.api_name, t])), [linkTypes])
  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])
  const linksById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links])

  const diff = useMemo(
    () => buildDiff(gpr.operations, objectsById, linksById, objectTypeById, objectTypeByApi, linkTypeById, linkTypeByApi),
    [gpr.operations, objectsById, linksById, objectTypeById, objectTypeByApi, linkTypeById, linkTypeByApi],
  )

  const beforeRfNodes = useMemo(() => layoutNodes(diff.beforeNodes), [diff.beforeNodes])
  const beforeRfEdges = useMemo(() => layoutEdges(diff.beforeEdges), [diff.beforeEdges])
  const afterRfNodes = useMemo(() => layoutNodes(diff.afterNodes), [diff.afterNodes])
  const afterRfEdges = useMemo(() => layoutEdges(diff.afterEdges), [diff.afterEdges])

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <DiffPane title="Before (current graph)" nodes={beforeRfNodes} edges={beforeRfEdges} empty="No existing entities are touched by this GPR" />
      <DiffPane title="After (proposed)" nodes={afterRfNodes} edges={afterRfEdges} empty="No nodes" />
    </div>
  )
}

interface DiffPaneProps {
  title: string
  nodes: Node[]
  edges: Edge[]
  empty: string
}

function DiffPane({ title, nodes, edges, empty }: DiffPaneProps) {
  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <div className="px-3 py-2 bg-white border-b border-gray-200 text-sm font-semibold text-gray-700">
        {title}
      </div>
      <div className="flex-1 relative min-h-[400px]">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 italic">
            {empty}
          </div>
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} size={1} color="#e5e7eb" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  )
}
