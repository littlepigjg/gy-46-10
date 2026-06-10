import { useState, useEffect } from 'react'
import {
  getScreenshotTags,
  addScreenshotTag,
  removeScreenshotTag,
  getTags,
  retagScreenshot,
  previewScreenshotTags
} from '../api.js'
import TagBadge from './TagBadge.jsx'

export default function ScreenshotTagManager({ screenshotId, onTagsChange }) {
  const [tags, setTags] = useState([])
  const [previewTags, setPreviewTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (screenshotId) {
      loadTags()
    }
  }, [screenshotId])

  useEffect(() => {
    if (searchQuery) {
      searchAvailableTags()
    } else {
      setAvailableTags([])
    }
  }, [searchQuery])

  const loadTags = async () => {
    try {
      const res = await getScreenshotTags(screenshotId)
      setTags(res.data)
      onTagsChange && onTagsChange(res.data)
    } catch (err) {
      console.error('加载标签失败:', err)
    }
  }

  const searchAvailableTags = async () => {
    try {
      const res = await getTags({ search: searchQuery, limit: 10 })
      const existingTagIds = new Set(tags.map(t => t.id))
      setAvailableTags(res.data.filter(t => !existingTagIds.has(t.id)))
    } catch (err) {
      console.error('搜索标签失败:', err)
    }
  }

  const handleAddTag = async (tag) => {
    try {
      const res = await addScreenshotTag(screenshotId, { tag_id: tag.id })
      setTags(res.data)
      setSearchQuery('')
      setAvailableTags([])
      onTagsChange && onTagsChange(res.data)
    } catch (err) {
      console.error('添加标签失败:', err)
    }
  }

  const handleCreateTag = async () => {
    if (!searchQuery.trim()) return
    try {
      const res = await addScreenshotTag(screenshotId, { tag_name: searchQuery.trim() })
      setTags(res.data)
      setSearchQuery('')
      setAvailableTags([])
      onTagsChange && onTagsChange(res.data)
    } catch (err) {
      console.error('创建并添加标签失败:', err)
    }
  }

  const handleRemoveTag = async (tag) => {
    try {
      const res = await removeScreenshotTag(screenshotId, tag.id)
      setTags(res.data)
      onTagsChange && onTagsChange(res.data)
    } catch (err) {
      console.error('移除标签失败:', err)
    }
  }

  const handleRetag = async () => {
    if (!confirm('确定重新生成自动标签？这将覆盖现有的自动标签。')) return
    setIsLoading(true)
    try {
      const res = await retagScreenshot(screenshotId)
      setTags(res.data.tags)
      onTagsChange && onTagsChange(res.data.tags)
    } catch (err) {
      console.error('重新打标签失败:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreviewTags = async () => {
    try {
      const res = await previewScreenshotTags(screenshotId)
      setPreviewTags(res.data.tags)
      setShowPreview(true)
    } catch (err) {
      console.error('预览标签失败:', err)
    }
  }

  const manualTags = tags.filter(t => t.is_manual)
  const autoTags = tags.filter(t => !t.is_manual)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">标签管理</h3>
        <div className="flex gap-2">
          <button
            onClick={handlePreviewTags}
            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            预览自动标签
          </button>
          <button
            onClick={handleRetag}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {isLoading ? '处理中...' : '重新打标签'}
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索或添加标签..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {searchQuery && availableTags.length === 0 && (
          <button
            onClick={handleCreateTag}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            创建 "{searchQuery}"
          </button>
        )}
        {searchQuery && availableTags.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {availableTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleAddTag(tag)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span>{tag.name}</span>
              </button>
            ))}
            <button
              onClick={handleCreateTag}
              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100"
            >
              + 创建新标签 "{searchQuery}"
            </button>
          </div>
        )}
      </div>

      {manualTags.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-2">手动标签</div>
          <div className="flex flex-wrap gap-1.5">
            {manualTags.map(tag => (
              <TagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                showConfidence
                onRemove={() => handleRemoveTag(tag)}
              />
            ))}
          </div>
        </div>
      )}

      {autoTags.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">自动标签</div>
          <div className="flex flex-wrap gap-1.5">
            {autoTags.map(tag => (
              <TagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                showConfidence
                onRemove={() => handleRemoveTag(tag)}
              />
            ))}
          </div>
        </div>
      )}

      {tags.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-400">
          暂无标签
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">预览自动标签</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {previewTags.length > 0 ? (
              <div className="space-y-2">
                {previewTags.map(({ tag, confidence }) => (
                  <div key={tag} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700">{tag}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">
                        {(confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-4">暂无自动标签建议</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
