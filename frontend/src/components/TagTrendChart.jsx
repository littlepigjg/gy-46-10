import { useMemo } from 'react'
import dayjs from 'dayjs'

export default function TagTrendChart({ trends, days = 30, maxTags = 8 }) {
  const chartData = useMemo(() => {
    if (!trends || trends.length === 0) return { dates: [], series: [] }

    const dateSet = new Set()
    const tagData = new Map()

    trends.forEach(item => {
      dateSet.add(item.date)
      if (!tagData.has(item.id)) {
        tagData.set(item.id, {
          id: item.id,
          name: item.name,
          color: item.color,
          total: 0,
          data: {}
        })
      }
      const tag = tagData.get(item.id)
      tag.data[item.date] = item.count
      tag.total += item.count
    })

    const dates = Array.from(dateSet).sort()
    const tagsArray = Array.from(tagData.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, maxTags)

    const series = tagsArray.map(tag => {
      const values = dates.map(date => tag.data[date] || 0)
      const maxValue = Math.max(...values, 1)
      return {
        ...tag,
        values,
        normalizedValues: values.map(v => v / maxValue)
      }
    })

    return { dates, series }
  }, [trends, maxTags])

  const formatDate = (dateStr) => {
    const date = dayjs(dateStr)
    if (days <= 7) return date.format('MM-DD')
    if (days <= 30) return date.format('MM-DD')
    return date.format('MM/DD')
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        暂无趋势数据
      </div>
    )
  }

  const { dates, series } = chartData
  const chartHeight = 200
  const padding = { top: 20, right: 20, bottom: 40, left: 40 }
  const width = 100
  const height = 100

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">标签趋势（近{days}天）</h3>

      <div className="relative" style={{ height: chartHeight }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((y, i) => (
            <line
              key={i}
              x1={padding.left / width * 100}
              y1={(height - padding.bottom - y * (height - padding.top - padding.bottom)) / height * 100}
              x2={(width - padding.right) / width * 100}
              y2={(height - padding.bottom - y * (height - padding.top - padding.bottom)) / height * 100}
              stroke="#f3f4f6"
              strokeWidth="0.5"
            />
          ))}

          {series.map((s, seriesIndex) => {
            const points = s.values.map((value, i) => {
              const x = padding.left + (i / (dates.length - 1)) * (width - padding.left - padding.right)
              const y = height - padding.bottom - (value / Math.max(...s.values, 1)) * (height - padding.top - padding.bottom)
              return `${x},${y}`
            }).join(' ')

            return (
              <g key={s.id}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {s.values.map((value, i) => {
                  const x = padding.left + (i / (dates.length - 1)) * (width - padding.left - padding.right)
                  const y = height - padding.bottom - (value / Math.max(...s.values, 1)) * (height - padding.top - padding.bottom)
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="2"
                      fill={s.color}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4">
          {dates.filter((_, i) => i % Math.ceil(dates.length / 6) === 0 || i === dates.length - 1).map((date, i) => (
            <span key={i} className="text-xs text-gray-400">
              {formatDate(date)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {series.map(tag => (
          <div key={tag.id} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span className="text-xs text-gray-600">{tag.name}</span>
            <span className="text-xs text-gray-400">({tag.total})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
