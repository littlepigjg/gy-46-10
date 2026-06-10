import { useMemo } from 'react'

export default function TagCloud({ tags, onTagClick, selectedTags = [], maxTags = 50 }) {
  const processedTags = useMemo(() => {
    if (!tags || tags.length === 0) return []

    const sorted = [...tags].sort((a, b) => b.usage_count - a.usage_count).slice(0, maxTags)
    const maxCount = Math.max(...sorted.map(t => t.usage_count || 0))
    const minCount = Math.min(...sorted.map(t => t.usage_count || 0))

    return sorted.map(tag => {
      const normalizedCount = maxCount === minCount
        ? 0.5
        : ((tag.usage_count || 0) - minCount) / (maxCount - minCount)

      const fontSize = 0.75 + normalizedCount * 1.25
      const opacity = 0.6 + normalizedCount * 0.4

      return {
        ...tag,
        fontSize: `${fontSize}rem`,
        opacity,
        isSelected: selectedTags.includes(tag.name)
      }
    }).sort(() => Math.random() - 0.5)
  }, [tags, selectedTags, maxTags])

  if (!tags || tags.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无标签数据
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2 items-center justify-center p-4">
      {processedTags.map(tag => (
        <button
          key={tag.id}
          onClick={() => onTagClick && onTagClick(tag)}
          className={`
            px-3 py-1.5 rounded-full transition-all duration-200
            hover:scale-105 hover:shadow-md
            ${tag.isSelected
              ? 'ring-2 ring-offset-2'
              : 'hover:opacity-90'
            }
          `}
          style={{
            fontSize: tag.fontSize,
            opacity: tag.isSelected ? 1 : tag.opacity,
            backgroundColor: tag.isSelected ? tag.color : `${tag.color}15`,
            color: tag.isSelected ? '#ffffff' : tag.color,
            ringColor: tag.color
          }}
        >
          <span className="font-medium">{tag.name}</span>
          <span
            className="ml-1 text-xs opacity-70"
            style={{ color: tag.isSelected ? '#ffffff' : tag.color }}
          >
            {tag.usage_count || 0}
          </span>
        </button>
      ))}
    </div>
  )
}
