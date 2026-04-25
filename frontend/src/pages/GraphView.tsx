import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeProps,
  Handle,
  Position,
  Panel,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { api } from '../api/client'
import type { ObjectType, ObjectInstance, LinkType, LinkInstance } from '../api/types'
import { Plus, Trash2, X, Link as LinkIcon, Filter, Eye, EyeOff, ChevronDown, ChevronUp, Play, RotateCcw, Share2, Copy, Check, Zap } from 'lucide-react'

/* ─── Performance thresholds ─── */
const PERF_NODE_THRESHOLD = 100
const PERF_EDGE_THRESHOLD = 200

/* ─── Custom Node (memoized) ─── */
const GraphNode = memo(function GraphNode({ data, selected }: NodeProps) {
  const isCompact = data.compact
  const truncatedProps = isCompact ? [] : Object.entries(data.properties || {}).slice(0, 3)
  return (
    <div
      className={`rounded-xl border-2 min-w-[180px] max-w-[260px] ${
        isCompact ? '' : 'shadow-lg transition-shadow'
      } ${
        selected ? 'shadow-xl ring-2 ring-brand-400' : ''
      }`}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <div
        className="px-3 py-2 rounded-t-[10px] text-white text-xs font-bold tracking-wide flex items-center gap-1.5"
        style={{ backgroundColor: data.color }}
      >
        <span className="opacity-70">{data.typeName}</span>
      </div>
      <div className="px-3 py-2 bg-white rounded-b-[10px]">
        <div className="font-semibold text-sm text-gray-900 truncate">{data.label}</div>
        {truncatedProps.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {truncatedProps.map(([k, v]) => (
              <div key={k} className="flex text-[11px] text-gray-500 gap-1">
                <span className="font-medium text-gray-600 shrink-0">{k}:</span>
                <span className="truncate">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" />
    </div>
  )
})

const nodeTypes = { graphNode: GraphNode }

/* ─── Edge color helpers ─── */
const EDGE_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function blendColors(colors: string[]): string {
  if (colors.length === 0) return '#6b7280'
  if (colors.length === 1) return colors[0]
  const rgbs = colors.map(hexToRgb)
  const avg: [number, number, number] = [0, 0, 0]
  for (const [r, g, b] of rgbs) {
    avg[0] += r
    avg[1] += g
    avg[2] += b
  }
  return rgbToHex(avg[0] / rgbs.length, avg[1] / rgbs.length, avg[2] / rgbs.length)
}

function buildLinkTypeColorMap(linkTypes: LinkType[]): Map<number, string> {
  return new Map(linkTypes.map((lt, i) => [lt.id, EDGE_COLORS[i % EDGE_COLORS.length]]))
}

/* ─── Layout helpers ─── */
function layoutNodes(
  objects: ObjectInstance[],
  objectTypes: ObjectType[],
): Node[] {
  const typeMap = new Map(objectTypes.map((t) => [t.id, t]))
  const grouped = new Map<number, ObjectInstance[]>()
  for (const obj of objects) {
    const arr = grouped.get(obj.object_type_id) || []
    arr.push(obj)
    grouped.set(obj.object_type_id, arr)
  }

  const nodes: Node[] = []
  let colIndex = 0
  for (const [typeId, instances] of grouped) {
    const type = typeMap.get(typeId)
    if (!type) continue
    const colX = colIndex * 320
    instances.forEach((inst, rowIndex) => {
      const titleProp = type.title_property
      const label =
        (titleProp && inst.properties[titleProp]
          ? String(inst.properties[titleProp])
          : null) ||
        (inst.properties['name'] ? String(inst.properties['name']) : null) ||
        (inst.properties['hostname'] ? String(inst.properties['hostname']) : null) ||
        `${type.name} #${inst.id}`
      nodes.push({
        id: `obj-${inst.id}`,
        type: 'graphNode',
        position: { x: colX, y: rowIndex * 160 },
        data: {
          label,
          typeName: type.name,
          color: type.color,
          properties: inst.properties,
          objectId: inst.id,
          objectTypeId: inst.object_type_id,
        },
      })
    })
    colIndex++
  }
  return nodes
}

function buildEdges(links: LinkInstance[], linkTypes: LinkType[], lightweight = false): Edge[] {
  const ltMap = new Map(linkTypes.map((lt) => [lt.id, lt]))
  const colorMap = buildLinkTypeColorMap(linkTypes)

  // Detect overlapping edges (same source-target pair, either direction)
  const pairKey = (s: number, t: number) => `${Math.min(s, t)}-${Math.max(s, t)}`
  const pairLinks = new Map<string, LinkInstance[]>()
  for (const link of links) {
    const key = pairKey(link.source_object_id, link.target_object_id)
    const arr = pairLinks.get(key) || []
    arr.push(link)
    pairLinks.set(key, arr)
  }

  return links.map((link) => {
    const lt = ltMap.get(link.link_type_id)
    const key = pairKey(link.source_object_id, link.target_object_id)
    const siblings = pairLinks.get(key) || [link]
    const isOverlap = siblings.length > 1

    // For overlapping edges: blend all sibling colors; for single: use own color
    let edgeColor: string
    if (isOverlap) {
      const siblingColors = [...new Set(siblings.map((s) => colorMap.get(s.link_type_id) || '#6b7280'))]
      edgeColor = blendColors(siblingColors)
    } else {
      edgeColor = colorMap.get(link.link_type_id) || '#6b7280'
    }

    return {
      id: `link-${link.id}`,
      source: `obj-${link.source_object_id}`,
      target: `obj-${link.target_object_id}`,
      label: lightweight ? '' : (lt?.name || ''),
      type: 'smoothstep',
      animated: !lightweight,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: edgeColor },
      style: { strokeWidth: 2, stroke: edgeColor },
      labelStyle: lightweight ? undefined : { fill: edgeColor, fontWeight: 600, fontSize: 11 },
      labelBgStyle: lightweight ? undefined : { fill: 'white', fillOpacity: 0.85 },
      data: { linkId: link.id, linkTypeId: link.link_type_id, edgeColor },
    }
  })
}

/* ─── Main Component ─── */
export default function GraphView() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkForm, setLinkForm] = useState({ linkTypeId: '' as number | '' })
  const [showFilters, setShowFilters] = useState(false)
  const [hiddenNodeTypes, setHiddenNodeTypes] = useState<Set<number>>(new Set())
  const [hiddenLinkTypes, setHiddenLinkTypes] = useState<Set<number>>(new Set())
  const [perfMode, setPerfMode] = useState(false)
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const highlightApplied = useRef(false)
  const typeFilterInitialized = useRef(false)

  // Cypher query state
  const [cypherInput, setCypherInput] = useState('')
  const [activeCypher, setActiveCypher] = useState<string | null>(null)
  const [cypherError, setCypherError] = useState<string | null>(null)
  const [cypherLoading, setCypherLoading] = useState(false)
  const [cypherObjectIds, setCypherObjectIds] = useState<Set<number> | null>(null)
  const [cypherLinkIds, setCypherLinkIds] = useState<Set<number> | null>(null)
  const [copied, setCopied] = useState(false)
  const cypherInitialized = useRef(false)

  // Queries
  const { data: objectTypes = [] } = useQuery({
    queryKey: ['objectTypes'],
    queryFn: () => api.get<ObjectType[]>('/ontology/object-types'),
  })
  const { data: allObjects = [] } = useQuery({
    queryKey: ['allObjects'],
    queryFn: () => api.get<ObjectInstance[]>('/ontology/objects?limit=500'),
  })
  const { data: linkTypes = [] } = useQuery({
    queryKey: ['linkTypes'],
    queryFn: () => api.get<LinkType[]>('/ontology/link-types'),
  })
  const { data: allLinks = [] } = useQuery({
    queryKey: ['allLinks'],
    queryFn: () => api.get<LinkInstance[]>('/ontology/links?limit=1000'),
  })

  // Mutations
  const createLink = useMutation({
    mutationFn: (data: { link_type_id: number; source_object_id: number; target_object_id: number }) =>
      api.post('/ontology/links', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allLinks'] })
      setShowLinkForm(false)
    },
  })

  const deleteLink = useMutation({
    mutationFn: (id: number) => api.delete(`/ontology/links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allLinks'] })
      setSelectedEdge(null)
    },
  })

  const deleteObject = useMutation({
    mutationFn: (id: number) => api.delete(`/ontology/objects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allObjects'] })
      queryClient.invalidateQueries({ queryKey: ['allLinks'] })
      setSelectedNode(null)
    },
  })

  // ── Cypher query execution ──
  const executeCypher = useCallback(async (query: string) => {
    if (!query.trim()) return
    setCypherLoading(true)
    setCypherError(null)
    try {
      const result = await api.post<{
        object_ids: number[]
        link_ids: number[]
        error: string | null
      }>('/ontology/cypher', { query })
      if (result.error) {
        setCypherError(result.error)
        setCypherObjectIds(null)
        setCypherLinkIds(null)
        setActiveCypher(null)
      } else {
        setCypherObjectIds(new Set(result.object_ids))
        setCypherLinkIds(new Set(result.link_ids))
        setActiveCypher(query)
        setCypherError(null)
        // Update URL
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('cypher', query)
          next.delete('highlight')
          return next
        }, { replace: true })
      }
    } catch (e: any) {
      setCypherError(e.message || 'Query failed')
      setCypherObjectIds(null)
      setCypherLinkIds(null)
      setActiveCypher(null)
    } finally {
      setCypherLoading(false)
    }
  }, [setSearchParams])

  const clearCypher = useCallback(() => {
    setCypherInput('')
    setActiveCypher(null)
    setCypherError(null)
    setCypherObjectIds(null)
    setCypherLinkIds(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('cypher')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const copyShareLink = useCallback(() => {
    const query = activeCypher || cypherInput
    if (!query) return
    const url = new URL(window.location.href)
    url.searchParams.set('cypher', query)
    url.searchParams.delete('highlight')
    navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeCypher, cypherInput])

  // Initialize from URL cypher param on mount
  useEffect(() => {
    if (cypherInitialized.current) return
    const cypherParam = searchParams.get('cypher')
    if (cypherParam) {
      cypherInitialized.current = true
      setCypherInput(cypherParam)
      executeCypher(cypherParam)
    }
  }, [searchParams, executeCypher])

  // Initialize hidden type filters from URL ?nodeTypes=&linkTypes= once data is loaded
  useEffect(() => {
    if (typeFilterInitialized.current) return
    if (objectTypes.length === 0 && linkTypes.length === 0) return
    const nodeTypesParam = searchParams.get('nodeTypes')
    const linkTypesParam = searchParams.get('linkTypes')
    if (!nodeTypesParam && !linkTypesParam) {
      typeFilterInitialized.current = true
      return
    }
    if (nodeTypesParam && objectTypes.length > 0) {
      const visible = new Set(nodeTypesParam.split(',').map((s: string) => Number(s)).filter((n: number) => !Number.isNaN(n)))
      setHiddenNodeTypes(new Set(objectTypes.filter((ot: ObjectType) => !visible.has(ot.id)).map((ot: ObjectType) => ot.id)))
    }
    if (linkTypesParam && linkTypes.length > 0) {
      const visible = new Set(linkTypesParam.split(',').map((s: string) => Number(s)).filter((n: number) => !Number.isNaN(n)))
      setHiddenLinkTypes(new Set(linkTypes.filter((lt: LinkType) => !visible.has(lt.id)).map((lt: LinkType) => lt.id)))
    }
    typeFilterInitialized.current = true
  }, [searchParams, objectTypes, linkTypes])

  // Filtered data (Cypher filter takes priority, then manual type filters)
  const filteredObjects = useMemo(
    () => {
      let objs = allObjects.filter((o) => !hiddenNodeTypes.has(o.object_type_id))
      if (cypherObjectIds) {
        objs = objs.filter((o) => cypherObjectIds.has(o.id))
      }
      return objs
    },
    [allObjects, hiddenNodeTypes, cypherObjectIds],
  )
  const visibleObjectIds = useMemo(
    () => new Set(filteredObjects.map((o) => o.id)),
    [filteredObjects],
  )
  const filteredLinks = useMemo(
    () => {
      let lnks = allLinks.filter(
        (l) =>
          !hiddenLinkTypes.has(l.link_type_id) &&
          visibleObjectIds.has(l.source_object_id) &&
          visibleObjectIds.has(l.target_object_id),
      )
      if (cypherLinkIds) {
        lnks = lnks.filter((l) => cypherLinkIds.has(l.id))
      }
      return lnks
    },
    [allLinks, hiddenLinkTypes, visibleObjectIds, cypherLinkIds],
  )

  // Auto-enable performance mode when data exceeds thresholds
  const autoPerf = filteredObjects.length > PERF_NODE_THRESHOLD || filteredLinks.length > PERF_EDGE_THRESHOLD
  const isPerf = perfMode || autoPerf

  // Build graph when data changes
  useEffect(() => {
    if (objectTypes.length && filteredObjects.length) {
      const newNodes = layoutNodes(filteredObjects, objectTypes)
      // In performance mode, mark nodes as compact to skip property rendering
      if (isPerf) {
        for (const n of newNodes) n.data = { ...n.data, compact: true }
      }
      setNodes(newNodes)
    } else if (filteredObjects.length === 0) {
      setNodes([])
    }
  }, [filteredObjects, objectTypes, setNodes, isPerf])

  // Auto-highlight from URL query param (?highlight=objectId)
  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId || highlightApplied.current || nodes.length === 0) return
    const targetNodeId = `obj-${highlightId}`
    const targetNode = nodes.find((n) => n.id === targetNodeId)
    if (targetNode) {
      setSelectedNode(targetNode)
      highlightApplied.current = true
      // Center on the highlighted node
      if (rfInstance.current) {
        const { x, y } = targetNode.position
        setTimeout(() => rfInstance.current?.setCenter(x + 130, y + 60, { zoom: 1.2, duration: 600 }), 200)
      }
      // Clean up the URL param
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('highlight')
        return next
      }, { replace: true })
    }
  }, [nodes, searchParams, setSearchParams])

  // Memoize link type color map for reuse in filter panel
  const linkTypeColorMap = useMemo(() => buildLinkTypeColorMap(linkTypes), [linkTypes])

  // Base edges from data
  const baseEdges = useMemo(
    () => buildEdges(filteredLinks, linkTypes, isPerf),
    [filteredLinks, linkTypes, isPerf],
  )

  // Apply highlight when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setEdges(baseEdges)
      return
    }
    const nodeId = selectedNode.id
    setEdges(
      baseEdges.map((e) => {
        const connected = e.source === nodeId || e.target === nodeId
        const baseColor = e.data?.edgeColor || '#6b7280'
        return {
          ...e,
          animated: connected,
          style: {
            ...e.style,
            strokeWidth: connected ? 4 : 1.5,
            stroke: connected ? baseColor : `${baseColor}30`,
          },
          markerEnd: {
            ...((e.markerEnd as any) || {}),
            color: connected ? baseColor : `${baseColor}30`,
          },
          labelStyle: {
            ...e.labelStyle,
            fill: connected ? baseColor : `${baseColor}30`,
            fontWeight: connected ? 700 : 400,
            fontSize: connected ? 12 : 10,
          },
          zIndex: connected ? 10 : 0,
        }
      }),
    )
  }, [selectedNode, baseEdges, setEdges])

  const toggleNodeType = useCallback((typeId: number) => {
    setHiddenNodeTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) next.delete(typeId)
      else next.add(typeId)
      return next
    })
  }, [])

  const toggleLinkType = useCallback((typeId: number) => {
    setHiddenLinkTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) next.delete(typeId)
      else next.add(typeId)
      return next
    })
  }, [])

  // Handlers
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const sourceId = parseInt(connection.source.replace('obj-', ''))
      const targetId = parseInt(connection.target.replace('obj-', ''))
      setLinkForm({ linkTypeId: linkTypes[0]?.id || '' })
      setShowLinkForm(true)
      // Store for form submission
      ;(window as any).__pendingLink = { sourceId, targetId }
    },
    [linkTypes],
  )

  const handleCreateLink = () => {
    const pending = (window as any).__pendingLink
    if (!pending || !linkForm.linkTypeId) return
    createLink.mutate({
      link_type_id: Number(linkForm.linkTypeId),
      source_object_id: pending.sourceId,
      target_object_id: pending.targetId,
    })
    delete (window as any).__pendingLink
  }

  const selectedNodeData = selectedNode?.data
  const selectedLinkType = selectedEdge
    ? linkTypes.find((lt) => lt.id === selectedEdge.data?.linkTypeId)
    : null

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-3">
        <h1 className="text-2xl font-bold">Graph View</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{filteredObjects.length}/{allObjects.length} nodes</span>
          <span>{filteredLinks.length}/{allLinks.length} edges</span>
          <button
            onClick={() => setPerfMode((v) => !v)}
            title={isPerf ? 'パフォーマンスモード ON：アニメーション・ラベル・プロパティ非表示' : 'パフォーマンスモードを有効にする'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isPerf
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            {isPerf ? 'Perf ON' : 'Perf'}
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showFilters || hiddenNodeTypes.size > 0 || hiddenLinkTypes.size > 0
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {(hiddenNodeTypes.size > 0 || hiddenLinkTypes.size > 0) && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-brand-600 text-white rounded-full">
                {hiddenNodeTypes.size + hiddenLinkTypes.size}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Cypher Query Bar */}
      <div className="mx-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={cypherInput}
              onChange={(e) => setCypherInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && cypherInput.trim()) {
                  executeCypher(cypherInput)
                }
              }}
              placeholder="Cypher クエリ: MATCH (n:Team)-[:belongs_to]->(m:ServerGroup)"
              className={`w-full pl-3 pr-10 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                cypherError ? 'border-red-300 bg-red-50' : activeCypher ? 'border-brand-400 bg-brand-50' : 'border-gray-200'
              }`}
            />
            {cypherInput && (
              <button
                onClick={() => {
                  setCypherInput('')
                  if (activeCypher) clearCypher()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => cypherInput.trim() && executeCypher(cypherInput)}
            disabled={!cypherInput.trim() || cypherLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {cypherLoading ? '実行中...' : '実行'}
          </button>
          {activeCypher && (
            <button
              onClick={clearCypher}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              title="クエリをリセット"
            >
              <RotateCcw className="w-4 h-4" />
              リセット
            </button>
          )}
          <button
            onClick={copyShareLink}
            disabled={!cypherInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="共有リンクをコピー"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'コピー済' : '共有'}
          </button>
        </div>
        {cypherError && (
          <div className="mt-1 text-xs text-red-600 font-medium">
            ⚠ {cypherError}
          </div>
        )}
        {activeCypher && !cypherError && (
          <div className="mt-1 text-xs text-brand-600 font-medium">
            ✓ クエリ適用中 — {filteredObjects.length} nodes, {filteredLinks.length} edges
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mx-2 mb-2 p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap gap-6 text-sm">
          {/* Node Type Filters */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Node Types</div>
            <div className="flex flex-wrap gap-2">
              {objectTypes.map((ot) => {
                const hidden = hiddenNodeTypes.has(ot.id)
                const count = allObjects.filter((o) => o.object_type_id === ot.id).length
                return (
                  <button
                    key={ot.id}
                    onClick={() => toggleNodeType(ot.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                      hidden
                        ? 'bg-white border-gray-200 text-gray-400 opacity-60'
                        : 'border-transparent text-white shadow-sm'
                    }`}
                    style={hidden ? undefined : { backgroundColor: ot.color }}
                  >
                    {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span className="font-medium">{ot.name}</span>
                    <span className={`text-xs ${hidden ? 'text-gray-400' : 'opacity-75'}`}>({count})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Link Type Filters */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Link Types</div>
            <div className="flex flex-wrap gap-2">
              {linkTypes.map((lt) => {
                const hidden = hiddenLinkTypes.has(lt.id)
                const count = allLinks.filter((l) => l.link_type_id === lt.id).length
                const ltColor = linkTypeColorMap.get(lt.id) || '#6b7280'
                return (
                  <button
                    key={lt.id}
                    onClick={() => toggleLinkType(lt.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                      hidden
                        ? 'bg-white border-gray-200 text-gray-400 opacity-60'
                        : 'border-transparent text-white shadow-sm'
                    }`}
                    style={hidden ? undefined : { backgroundColor: ltColor }}
                  >
                    {hidden ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: ltColor }} />
                        <EyeOff className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span className="font-medium">{lt.name}</span>
                    <span className={`text-xs ${hidden ? 'text-gray-400' : 'opacity-75'}`}>({count})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reset */}
          {(hiddenNodeTypes.size > 0 || hiddenLinkTypes.size > 0) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setHiddenNodeTypes(new Set())
                  setHiddenLinkTypes(new Set())
                }}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium underline"
              >
                Reset All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Canvas + Sidebar */}
      <div className="flex-1 flex rounded-xl overflow-hidden border border-gray-200">
        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            onInit={(instance) => { rfInstance.current = instance }}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: !isPerf,
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={!isPerf || nodes.length < 300}
          >
            <Controls position="bottom-left" />
            {!isPerf && (
              <MiniMap
                position="bottom-right"
                nodeColor={(n) => n.data?.color || '#6366f1'}
                maskColor="rgba(0,0,0,0.08)"
                className="!bg-gray-50 !border-gray-200"
              />
            )}
            <Background gap={20} size={1} color="#e5e7eb" />
          </ReactFlow>
        </div>

        {/* Side Panel */}
        {(selectedNode || selectedEdge) && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-4">
            {selectedNode && selectedNodeData && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg">{selectedNodeData.label}</h3>
                  <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <span
                  className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-full mb-3"
                  style={{ backgroundColor: selectedNodeData.color }}
                >
                  {selectedNodeData.typeName}
                </span>

                <div className="space-y-2">
                  {Object.entries(selectedNodeData.properties || {}).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs font-medium text-gray-500">{k}</div>
                      <div className="text-sm text-gray-900 break-words">{String(v)}</div>
                    </div>
                  ))}
                </div>

                {/* Connected links */}
                <div className="mt-4 pt-3 border-t">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Links</h4>
                  {edges
                    .filter(
                      (e) =>
                        e.source === selectedNode.id || e.target === selectedNode.id,
                    )
                    .map((e) => {
                      const otherNodeId = e.source === selectedNode.id ? e.target : e.source
                      const otherNode = nodes.find((n) => n.id === otherNodeId)
                      const direction = e.source === selectedNode.id ? '→' : '←'
                      return (
                        <div
                          key={e.id}
                          className="flex items-center gap-2 text-sm py-1 text-gray-700"
                        >
                          <LinkIcon className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-400">{direction}</span>
                          <span>{e.label}</span>
                          <span className="text-gray-400">{direction}</span>
                          <span className="font-medium">{otherNode?.data?.label || otherNodeId}</span>
                        </div>
                      )
                    })}
                </div>

                <button
                  onClick={() => deleteObject.mutate(selectedNodeData.objectId)}
                  className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 w-full justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Object
                </button>
              </>
            )}

            {selectedEdge && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg">{selectedEdge.label || 'Link'}</h3>
                  <button onClick={() => setSelectedEdge(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {selectedLinkType && (
                  <div className="space-y-2 text-sm">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs font-medium text-gray-500">Type</div>
                      <div className="text-gray-900">{selectedLinkType.name}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs font-medium text-gray-500">Cardinality</div>
                      <div className="text-gray-900">{selectedLinkType.cardinality}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs font-medium text-gray-500">Source</div>
                      <div className="text-gray-900">
                        {nodes.find((n) => n.id === selectedEdge.source)?.data?.label || selectedEdge.source}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs font-medium text-gray-500">Target</div>
                      <div className="text-gray-900">
                        {nodes.find((n) => n.id === selectedEdge.target)?.data?.label || selectedEdge.target}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => selectedEdge.data?.linkId && deleteLink.mutate(selectedEdge.data.linkId)}
                  className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 w-full justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Link
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Link creation modal */}
      {showLinkForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="font-bold text-lg mb-4">Create Link</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Link Type</label>
              <select
                value={linkForm.linkTypeId}
                onChange={(e) => setLinkForm({ linkTypeId: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {linkTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.cardinality})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowLinkForm(false)
                  delete (window as any).__pendingLink
                }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLink}
                disabled={!linkForm.linkTypeId}
                className="px-4 py-2 text-sm text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
