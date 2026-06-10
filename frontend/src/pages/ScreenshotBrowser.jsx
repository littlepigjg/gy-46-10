import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { getAllScreenshots, getPopularTags } from '../api.js'
import TagFilter from '../components/TagFilter.jsx'
import TagBadge from '../components/TagBadge.jsx'
import TagCloud from '../components/TagCloud.jsx'

function getScreenshotUrl(filePath) {
  const idx = filePath.indexOf('screenshots')
  if (idx === -1) return ''
  return '/' + filePath.slice(idx).replace(/\\/g, '/')
}

export default function ScreenshotBrowser() {
  const [screenshots, setScreenshots] = useState([])
  const [allTags, setAllTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState('grid')
  const [previewImage, setPreviewImage] = useState(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState(null)
  const [showTagCloud, setShowTagCloud] = useState(true)

  useEffect(() => {
    loadPopularTags()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [selectedTags, searchQuery])

  useEffect(() => {
    loadScreenshots()
  }, [selectedTags, searchQuery, page])

  const loadPopularTags = async () => {
    try {
      const res = await getPopularTags(50)
      setAllTags(res.data)
    } catch (err) {
      console.error('加载热门标签失败:', err)
    }
  }

  const loadScreenshots = async () => {
    setIsLoading(true)
    try {
      const params = {
        page,
        limit: viewMode === 'grid' ? 12 : 20
      }
      if (selectedTags.length > 0) {
        params.tags = selectedTags.join(',')
      }
      if (searchQuery) {
        params.search = searchQuery
      }

      const res = await getAllScreenshots(params)
      setScreenshots(res.data.screenshots)
      setPagination(res.data.pagination)
    } catch (err) {
      console.error('加载截图失败:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagClick = (tag) => {
    if (selectedTags.includes(tag.name)) {
      setSelectedTags(selectedTags.filter(t => t !== tag.name))
    } else {
      setSelectedTags([...selectedTags, tag.name])
    }
  }

  const handleViewImage = (shot) => {
    const imgUrl = getScreenshotUrl(shot.file_path)
    setPreviewImage({ src: imgUrl, time: shot.created_at, title: shot.url_name })
  }

  const groupedByDate = screenshots.reduce((acc, shot) => {
    const date = dayjs(shot.created_at).format('YYYY-MM-DD')
    if (!acc[date]) acc[date] = []
    acc[date].push(shot)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">截图浏览</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {pagination.total} 张截图
            {selectedTags.length > 0 && ` · 已筛选 ${selectedTags.length} 个标签`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow text-gray-700' : 'text-gray-500'
              }`}
            >
              网格
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-gray-700' : 'text-gray-500'
              }`}
            >
              列表
            </button>
          </div>
          <button
            onClick={() => setShowTagCloud(!showTagCloud)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              showTagCloud ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {showTagCloud ? '隐藏标签云' : '显示标签云'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-72 flex-shrink-0 space-y-4">
          <TagFilter
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            limit={30}
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">搜索</h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索URL、标题..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 space-y-6">
          {showTagCloud && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">热门标签</h3>
              <TagCloud
                tags={allTags}
                onTagClick={handleTagClick}
                selectedTags={selectedTags}
                maxTags={30}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : screenshots.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              暂无符合条件的截图
            </div>
          ) : viewMode === 'grid' ? (
            <div className="space-y-8">
              {Object.entries(groupedByDate).map(([date, shots]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-lg font-semibold text-gray-800">{date}</div>
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <div className="text-sm text-gray-500">{shots.length} 张</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {shots.map((shot) => {
                      const imgUrl = getScreenshotUrl(shot.file_path)
                      return (
                        <div
                          key={shot.id}
                          className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all cursor-pointer ${
                            selectedScreenshot?.id === shot.id ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => setSelectedScreenshot(shot)}
                        >
                          <div
                            className="relative bg-gray-100 overflow-hidden"
                            style={{ aspectRatio: '16/9' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewImage(shot)
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`screenshot-${shot.id}`}
                              className="w-full h-full object-cover object-top"
                              loading="lazy"
                            />
                          </div>
                          <div className="p-3">
                            <div className="text-sm font-medium text-gray-700 truncate mb-1">
                              {shot.url_name}
                            </div>
                            <div className="text-xs text-gray-400 mb-2">
                              {dayjs(shot.created_at).format('HH:mm:ss')}
                            </div>
                            {shot.tags && shot.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {shot.tags.slice(0, 3).map(tag => (
                                  <TagBadge key={tag.id} tag={tag} size="sm" />
                                ))}
                                {shot.tags.length > 3 && (
                                  <span className="text-xs text-gray-400">
                                    +{shot.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">截图</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标签</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {screenshots.map(shot => (
                    <tr
                      key={shot.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedScreenshot(shot)}
                    >
                      <td className="px-4 py-3">
                        <img
                          src={getScreenshotUrl(shot.file_path)}
                          alt="thumb"
                          className="w-24 h-14 object-cover rounded"
                          onClick={(e) => { e.stopPropagation(); handleViewImage(shot) }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-700 truncate max-w-xs">
                          {shot.url_name}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-xs">
                          {shot.url}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {dayjs(shot.created_at).format('YYYY-MM-DD HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {shot.tags?.slice(0, 4).map(tag => (
                            <TagBadge key={tag.id} tag={tag} size="sm" />
                          ))}
                          {shot.tags?.length > 4 && (
                            <span className="text-xs text-gray-400">+{shot.tags.length - 4}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500 px-4">
                第 {page} / {pagination.pages} 页
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex flex-col"
          onClick={() => setPreviewImage(null)}
        >
          <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
            <div>
              <h3 className="text-white font-medium">{previewImage.title}</h3>
              <p className="text-gray-400 text-sm">{dayjs(previewImage.time).format('YYYY-MM-DD HH:mm:ss')}</p>
            </div>
            <button className="text-white hover:text-gray-300 text-2xl leading-none">×</button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <img
              src={previewImage.src}
              alt="preview"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
