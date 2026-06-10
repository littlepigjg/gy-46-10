import { useState, useEffect } from 'react'
import { createTag, updateTag, deleteTag, addTagSynonym, removeTagSynonym, getTags } from '../api.js'
import TagBadge from './TagBadge.jsx'

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#64748B', '#475569', '#334155'
]

export default function TagEditor({ tag, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    description: '',
    parent_id: null
  })
  const [newSynonym, setNewSynonym] = useState('')
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tag) {
      setFormData({
        name: tag.name,
        color: tag.color,
        description: tag.description || '',
        parent_id: tag.parent_id || null
      })
    }
    loadAllTags()
  }, [tag])

  const loadAllTags = async () => {
    try {
      const res = await getTags({ sort: 'name' })
      setAllTags(res.data.filter(t => !tag || t.id !== tag.id))
    } catch (err) {
      console.error('加载标签失败:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (tag) {
        await updateTag(tag.id, formData)
      } else {
        await createTag(formData)
      }
      onSaved && onSaved()
      onClose && onClose()
    } catch (err) {
      setError(err.response?.data?.error || '保存失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!tag) return
    if (!confirm(`确定删除标签"${tag.name}"？此操作不可恢复。`)) return

    try {
      await deleteTag(tag.id)
      onSaved && onSaved()
      onClose && onClose()
    } catch (err) {
      setError(err.response?.data?.error || '删除失败')
    }
  }

  const handleAddSynonym = async () => {
    if (!tag || !newSynonym.trim()) return

    try {
      await addTagSynonym(tag.id, { synonym: newSynonym.trim() })
      setNewSynonym('')
      onSaved && onSaved()
    } catch (err) {
      setError(err.response?.data?.error || '添加同义词失败')
    }
  }

  const handleRemoveSynonym = async (synonym) => {
    if (!tag) return
    try {
      await removeTagSynonym(tag.id, synonym)
      onSaved && onSaved()
    } catch (err) {
      setError(err.response?.data?.error || '删除同义词失败')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            {tag ? '编辑标签' : '创建标签'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                标签名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入标签名称"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                标签颜色
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      formData.color === color ? 'ring-2 ring-offset-2' : ''
                    }`}
                    style={{ backgroundColor: color, ringColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="标签描述（可选）"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                父标签
              </label>
              <select
                value={formData.parent_id || ''}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">无（作为顶级标签）</option>
                {allTags.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {tag && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  删除标签
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? '保存中...' : tag ? '保存' : '创建'}
              </button>
            </div>
          </form>

          {tag && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                同义词映射
              </label>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newSynonym}
                  onChange={(e) => setNewSynonym(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSynonym())}
                  placeholder="输入同义词"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddSynonym}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  添加
                </button>
              </div>

              {tag.synonyms && tag.synonyms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tag.synonyms.map(synonym => (
                    <TagBadge
                      key={synonym}
                      tag={{ ...tag, name: synonym, is_manual: false }}
                      size="sm"
                      onRemove={() => handleRemoveSynonym(synonym)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">暂无同义词</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
