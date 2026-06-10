import { useState, useEffect } from 'react'
import { getTags, getPopularTags } from '../api.js'
import TagBadge from './TagBadge.jsx'

export default function TagFilter({ selectedTags = [], onTagsChange, mode = 'multi', limit = 20 }) {
  const [tags, setTags] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadTags()
  }, [search])

  const loadTags = async () => {
    setIsLoading(true)
    try {
      const res = search
        ? await getTags({ search, limit })
        : await getPopularTags(limit)
      setTags(res.data)
    } catch (err) {
      console.error('加载标签失败:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagClick = (tag) => {
    if (!onTagsChange) return

    if (mode === 'single') {
      onTagsChange(selectedTags.includes(tag.name) ? [] : [tag.name])
    } else {
      if (selectedTags.includes(tag.name)) {
        onTagsChange(selectedTags.filter(t => t !== tag.name))
      } else {
        onTagsChange([...selectedTags, tag.name])
      }
    }
  }

  const handleRemoveTag = (tagName) => {
    if (!onTagsChange) return
    onTagsChange(selectedTags.filter(t => t !== tagName))
  }

  const handleClearAll = () => {
    if (onTagsChange) {
      onTagsChange([])
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">标签筛选</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            清除全部
          </button>
        )}
      </div>

      <div className="relative mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标签..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {selectedTags.length > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-2">已选择 {selectedTags.length} 个标签:</div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map(tagName => {
              const tag = tags.find(t => t.name === tagName) || { name: tagName, color: '#6B7280' }
              return (
                <TagBadge
                  key={tagName}
                  tag={tag}
                  size="sm"
                  onRemove={() => handleRemoveTag(tagName)}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {tags.filter(t => !selectedTags.includes(t.name)).map(tag => (
          <TagBadge
            key={tag.id}
            tag={tag}
            size="sm"
            className="cursor-pointer hover:opacity-80"
            onClick={() => handleTagClick(tag)}
          />
        ))}
      </div>

      {tags.length === 0 && !isLoading && (
        <div className="text-center py-4 text-sm text-gray-400">
          {search ? '未找到匹配的标签' : '暂无标签'}
        </div>
      )}
    </div>
  )
}
