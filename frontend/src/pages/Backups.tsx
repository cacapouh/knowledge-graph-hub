import { useState, useEffect, useCallback } from 'react'
import {
  HardDrive,
  RotateCcw,
  Trash2,
  Plus,
  Clock,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import type { GraphBackup } from '../api/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const changeTypeLabels: Record<string, { label: string; color: string }> = {
  create_object: { label: 'ノード作成', color: 'bg-green-100 text-green-800' },
  update_object: { label: 'ノード更新', color: 'bg-blue-100 text-blue-800' },
  delete_object: { label: 'ノード削除', color: 'bg-red-100 text-red-800' },
  create_link: { label: 'エッジ作成', color: 'bg-green-100 text-green-800' },
  delete_link: { label: 'エッジ削除', color: 'bg-red-100 text-red-800' },
  create_object_type: { label: '型追加', color: 'bg-purple-100 text-purple-800' },
  update_object_type: { label: '型更新', color: 'bg-purple-100 text-purple-800' },
  delete_object_type: { label: '型削除', color: 'bg-red-100 text-red-800' },
  create_property_type: { label: 'プロパティ追加', color: 'bg-purple-100 text-purple-800' },
  delete_property_type: { label: 'プロパティ削除', color: 'bg-red-100 text-red-800' },
  create_link_type: { label: 'リンク型追加', color: 'bg-purple-100 text-purple-800' },
  delete_link_type: { label: 'リンク型削除', color: 'bg-red-100 text-red-800' },
  create_action_type: { label: 'アクション追加', color: 'bg-purple-100 text-purple-800' },
  manual: { label: '手動', color: 'bg-gray-100 text-gray-800' },
  pre_restore: { label: '復元前', color: 'bg-yellow-100 text-yellow-800' },
}

export default function Backups() {
  const [backups, setBackups] = useState<GraphBackup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<GraphBackup[]>('/backups')
      setBackups(data)
    } catch (err) {
      showToast('error', 'バックアップ一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const handleCreate = async () => {
    try {
      setCreating(true)
      await api.post('/backups', { description: '手動バックアップ' })
      showToast('success', 'バックアップを作成しました')
      await fetchBackups()
    } catch (err) {
      showToast('error', 'バックアップの作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backup: GraphBackup) => {
    if (!confirm(`「${formatDate(backup.created_at)}」のバックアップに復元しますか？\n\n現在のデータは安全のため自動バックアップされます。\n復元後はページをリロードしてください。`)) {
      return
    }
    try {
      setRestoring(backup.id)
      await api.post(`/backups/${backup.id}/restore`)
      showToast('success', '復元が完了しました。ページをリロードしてください。')
      await fetchBackups()
    } catch (err) {
      showToast('error', '復元に失敗しました')
    } finally {
      setRestoring(null)
    }
  }

  const handleDelete = async (backup: GraphBackup) => {
    if (!confirm(`このバックアップを削除しますか？\n${formatDate(backup.created_at)}`)) {
      return
    }
    try {
      await api.delete(`/backups/${backup.id}`)
      showToast('success', 'バックアップを削除しました')
      await fetchBackups()
    } catch (err) {
      showToast('error', '削除に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">グラフバックアップ</h1>
          <p className="mt-1 text-sm text-gray-500">
            グラフの変更時に自動でスナップショットが保存されます（最大50件）
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchBackups}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {creating ? '作成中...' : '手動バックアップ'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 rounded-lg">
              <HardDrive className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{backups.length}</p>
              <p className="text-xs text-gray-500">バックアップ数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <FileArchive className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatBytes(backups.reduce((sum: number, b: GraphBackup) => sum + b.size_bytes, 0))}
              </p>
              <p className="text-xs text-gray-500">合計サイズ</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {backups.length > 0 ? formatDate(backups[0].created_at) : '—'}
              </p>
              <p className="text-xs text-gray-500">最新バックアップ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <HardDrive className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">バックアップはまだありません</p>
            <p className="text-sm mt-1">グラフに変更を加えると自動でバックアップされます</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日時
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  変更種別
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  説明
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  サイズ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {backups.map((backup) => {
                const ct = changeTypeLabels[backup.change_type] || {
                  label: backup.change_type,
                  color: 'bg-gray-100 text-gray-800',
                }
                return (
                  <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(backup.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ct.color}`}
                      >
                        {ct.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {backup.description || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatBytes(backup.size_bytes)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRestore(backup)}
                          disabled={restoring === backup.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          title="このバックアップに復元"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {restoring === backup.id ? '復元中...' : '復元'}
                        </button>
                        <button
                          onClick={() => handleDelete(backup)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                          title="このバックアップを削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
