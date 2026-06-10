export default function TagBadge({ tag, onRemove, showConfidence = false, size = 'md', className = '' }) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full font-medium transition-colors'
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  }

  const bgColor = tag.is_manual
    ? `${tag.color} text-white`
    : `${tag.color}20 text-gray-700 border border-gray-200`

  return (
    <span
      className={`${baseClasses} ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: tag.is_manual ? tag.color : `${tag.color}20`,
        color: tag.is_manual ? '#ffffff' : tag.color,
        border: tag.is_manual ? 'none' : `1px solid ${tag.color}40`
      }}
    >
      <span>{tag.name}</span>
      {showConfidence && tag.confidence !== undefined && (
        <span className="opacity-70">{(tag.confidence * 100).toFixed(0)}%</span>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(tag)
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full w-4 h-4 flex items-center justify-center text-current"
        >
          ×
        </button>
      )}
    </span>
  )
}
