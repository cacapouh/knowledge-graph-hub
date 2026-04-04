import { useState, useCallback, useEffect, useMemo } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { api } from '../api/client'
import type { ObjectType, ObjectInstance, LinkType, LinkInstance } from '../api/types'
import { Plus, Trash2, X, Link as LinkIcon } from 'lucide-react'

/* ─── Custom Node ─── */
function GraphNode({ data, selected }: NodeProps) {
  const truncatedProps = Object.entries(data.properties || {}).slice(0, 3)
  return (
    <div
      className={`rounded-xl shadow-lg border-2 min-w-[180px] max-w-[260px] transition-shadow ${
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
}

const nodeTypes = { graphNode: GraphNode }

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

function buildEdges(links: LinkInstance[], linkTypes: LinkType[]): Edge[] {
  const ltMap = new Map(linkTypes.map((lt) => [lt.id, lt]))
  return links.map((link) => {
    const lt = ltMap.get(link.link_type_id)
    return {
      id: `link-${link.id}`,
      source: `obj-${link.source_object_id}`,
      target: `obj-${link.target_object_id}`,
      label: lt?.name || '',
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 2 },
      data: { linkId: link.id, linkTypeId: link.link_type_id },
    }
  })
}

/* ─── Main Component ─── */
export default function GraphView() {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkForm, setLinkForm] = useState({ linkTypeId: '' as number | '' })

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

  // Build graph when data changes
  useEffect(() => {
    if (objectTypes.length && allObjects.length) {
      const newNodes = layoutNodes(allObjects, objectTypes)
      setNodes(newNodes)
    }
  }, [allObjects, objectTypes, setNodes])

  useEffect(() => {
    if (allLinks.length >= 0) {
      setEdges(buildEdges(allLinks, linkTypes))
    }
  }, [allLinks, linkTypes, setEdges])

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
          <span>{allObjects.length} nodes</span>
          <span>{allLinks.length} edges</span>
        </div>
      </div>

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
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
          >
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => n.data?.color || '#6366f1'}
              maskColor="rgba(0,0,0,0.08)"
              className="!bg-gray-50 !border-gray-200"
            />
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
