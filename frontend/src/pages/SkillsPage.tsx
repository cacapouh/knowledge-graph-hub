import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Skill, MCPConfig } from '../api/types'
import { Plus, Trash2, Pencil, X, Save, Sparkles } from 'lucide-react'

type SkillDraft = {
  name: string
  description: string
  prompt: string
  mcps: MCPConfig[]
}

const EMPTY_DRAFT: SkillDraft = { name: '', description: '', prompt: '', mcps: [] }

const EMPTY_MCP: MCPConfig = {
  name: '',
  type: 'stdio',
  command: '',
  args: [],
  env: {},
  url: '',
  headers: {},
}

function linesToList(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean)
}

function listToLines(xs: string[]): string {
  return (xs ?? []).join('\n')
}

function linesToMap(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of s.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

function mapToLines(m: Record<string, string>): string {
  return Object.entries(m ?? {}).map(([k, v]) => `${k}=${v}`).join('\n')
}

function MCPEditor({
  mcps,
  onChange,
}: {
  mcps: MCPConfig[]
  onChange: (next: MCPConfig[]) => void
}) {
  const update = (i: number, patch: Partial<MCPConfig>) => {
    const next = mcps.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const remove = (i: number) => onChange(mcps.filter((_, j) => j !== i))
  const add = () => onChange([...mcps, { ...EMPTY_MCP }])

  return (
    <div className="space-y-3">
      {mcps.map((m, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center gap-2">
            <input
              placeholder="MCP name (e.g. playwright)"
              value={m.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
            />
            <select
              value={m.type}
              onChange={(e) => update(i, { type: e.target.value as MCPConfig['type'] })}
              className="px-2 py-1 text-sm border border-gray-300 rounded"
            >
              <option value="stdio">stdio</option>
              <option value="http">http</option>
              <option value="sse">sse</option>
            </select>
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 text-gray-400 hover:text-red-500"
              title="Remove MCP"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {m.type === 'stdio' ? (
            <>
              <input
                placeholder="command (e.g. npx)"
                value={m.command ?? ''}
                onChange={(e) => update(i, { command: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
              />
              <textarea
                placeholder="args (one per line)&#10;-y&#10;@modelcontextprotocol/server-playwright"
                value={listToLines(m.args)}
                onChange={(e) => update(i, { args: linesToList(e.target.value) })}
                rows={3}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
              />
            </>
          ) : (
            <input
              placeholder="url (https://...)"
              value={m.url ?? ''}
              onChange={(e) => update(i, { url: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
            />
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 select-none">env / headers</summary>
            <div className="mt-2 space-y-2">
              <textarea
                placeholder="env (KEY=value, one per line)"
                value={mapToLines(m.env)}
                onChange={(e) => update(i, { env: linesToMap(e.target.value) })}
                rows={2}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
              <textarea
                placeholder="headers (Header-Name=value, one per line)"
                value={mapToLines(m.headers)}
                onChange={(e) => update(i, { headers: linesToMap(e.target.value) })}
                rows={2}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
            </div>
          </details>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded"
      >
        <Plus className="w-3 h-3" /> Add MCP
      </button>
    </div>
  )
}

function SkillForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
}: {
  draft: SkillDraft
  setDraft: (d: SkillDraft) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  pending: boolean
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
    >
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
        <input
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Prompt *</label>
        <textarea
          required
          value={draft.prompt}
          onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">MCPs</label>
        <MCPEditor mcps={draft.mcps} onChange={(mcps) => setDraft({ ...draft, mcps })} />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {pending ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function SkillsPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createDraft, setCreateDraft] = useState<SkillDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<SkillDraft>(EMPTY_DRAFT)

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.get<Skill[]>('/skills'),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['skills'] })

  const createSkill = useMutation({
    mutationFn: (d: SkillDraft) => api.post<Skill>('/skills', d),
    onSuccess: () => {
      invalidate()
      setShowCreate(false)
      setCreateDraft(EMPTY_DRAFT)
    },
  })

  const updateSkill = useMutation({
    mutationFn: ({ id, d }: { id: number; d: SkillDraft }) => api.patch<Skill>(`/skills/${id}`, d),
    onSuccess: () => {
      invalidate()
      setEditingId(null)
    },
  })

  const deleteSkill = useMutation({
    mutationFn: (id: number) => api.delete(`/skills/${id}`),
    onSuccess: invalidate,
  })

  const startEdit = (s: Skill) => {
    setEditingId(s.id)
    setEditDraft({
      name: s.name,
      description: s.description,
      prompt: s.prompt,
      mcps: s.mcps ?? [],
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Skills</h1>
            <p className="text-sm text-gray-500">Reusable skill bundles (prompt + MCPs).</p>
          </div>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" /> New Skill
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6">
          <SkillForm
            draft={createDraft}
            setDraft={setCreateDraft}
            onSubmit={() => createSkill.mutate(createDraft)}
            onCancel={() => {
              setShowCreate(false)
              setCreateDraft(EMPTY_DRAFT)
            }}
            submitLabel="Create"
            pending={createSkill.isPending}
          />
          {createSkill.isError && (
            <p className="mt-2 text-sm text-red-600">{(createSkill.error as Error).message}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-gray-400">No skills defined yet.</p>
      ) : (
        <div className="space-y-3">
          {skills.map((s) =>
            editingId === s.id ? (
              <div key={s.id}>
                <SkillForm
                  draft={editDraft}
                  setDraft={setEditDraft}
                  onSubmit={() => updateSkill.mutate({ id: s.id, d: editDraft })}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                  pending={updateSkill.isPending}
                />
                {updateSkill.isError && (
                  <p className="mt-2 text-sm text-red-600">{(updateSkill.error as Error).message}</p>
                )}
              </div>
            ) : (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{s.name}</h2>
                    {s.description && <p className="text-sm text-gray-600 mt-0.5">{s.description}</p>}
                    <p className="mt-2 text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">{s.prompt}</p>
                    {s.mcps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {s.mcps.map((m, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-mono">
                            {m.name} <span className="text-amber-400">{m.type}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(s)}
                      className="p-1.5 text-gray-400 hover:text-brand-600"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete skill "${s.name}"?`)) deleteSkill.mutate(s.id)
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
