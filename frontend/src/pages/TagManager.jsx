import { useState, useEffect } from 'react'
import { getTags, getTagHierarchy, getTagRules, createTagRule, updateTagRule, deleteTagRule, autoTagAll } from '../api.js'
import TagBadge from '../components/TagBadge.jsx'
import TagEditor from '../components/TagEditor.jsx'
import TagCloud from '../components/TagCloud.jsx'
import TagTrendChart from '../components/TagTrendChart.jsx'
import { getTagTrends } from '../api.js'

const RULE_TYPES = [
  { value: 'url_contains', label: 'URL包含' },
  { value: 'url_regex', label: 'URL正则' },
  { value: 'domain_is', label: '域名匹配' },
  { value: 'path_contains', label: '路径包含' }
]

export default function TagManager() {
  const [activeTab, setActiveTab] = useState('cloud')
  const [tags, setTags] = useState([])
  const [hierarchy, setHierarchy] = useState([])
  const [trends, setTrends] = useState([])
  const [rules, setRules] = useState([])
  const [showEditor, setShowEditor] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [trendDays, setTrendDays] = useState(30)
  const [isAutoTagging, setIsAutoTagging] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab, trendDays])

  const loadData = async () => {
    try {
      if (activeTab === 'cloud' || activeTab === 'list' || activeTab === 'hierarchy') {
        const [tagsRes, hierarchyRes] = await Promise.all([
          getTags({ sort: 'usage' }),
          getTagHierarchy()
        ])
        setTags(tagsRes.data)
        setHierarchy(hierarchyRes.data)
      }
      if (activeTab === 'trends') {
        const res = await getTagTrends(trendDays)
        setTrends(res.data)
      }
      if (activeTab === 'rules') {
        const res = await getTagRules()
        setRules(res.data)
      }
    } catch (err) {
      console.error('加载数据失败:', err)
    }
  }

  const handleCreateTag = () => {
    setEditingTag(null)
    setShowEditor(true)
  }

  const handleEditTag = (tag) => {
    setEditingTag(tag)
    setShowEditor(true)
  }

  const handleTagSaved = () => {
    setShowEditor(false)
    setEditingTag(null)
    loadData()
  }

  const handleAutoTagAll = async () => {
    if (!confirm('确定为所有截图重新生成自动标签？这可能需要一些时间。')) return
    setIsAutoTagging(true)
    try {
      const res = await autoTagAll()
      alert(`成功处理 ${res.data.processed} / ${res.data.total} 张截图`)
      loadData()
    } catch (err) {
      console.error('批量打标签失败:', err)
      alert('批量打标签失败')
    } finally {
      setIsAutoTagging(false)
    }
  }

  const handleCreateRule = async () => {
    if (tags.length === 0) {
      alert('请先创建标签')
      return
    }
    try {
      const defaultTag = tags[0]
      await createTagRule({
        tag_id: defaultTag.id,
        rule_type: 'url_contains',
        rule_pattern: '',
        weight: 1.0
      })
      loadData()
    } catch (err) {
      console.error('创建规则失败:', err)
    }
  }

  const handleUpdateRule = async (id, field, value) => {
    try {
      await updateTagRule(id, { [field]: value })
      loadData()
    } catch (err) {
      console.error('更新规则失败:', err)
    }
  }

  const handleDeleteRule = async (id) => {
    if (!confirm('确定删除此规则？')) return
    try {
      await deleteTagRule(id)
      loadData()
    } catch (err) {
      console.error('删除规则失败:', err)
    }
  }

  const renderHierarchy = (items, level = 0) => {
    return items.map(item => (
      <div key={item.id}>
        <div
          className={`flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg cursor-pointer ${level > 0 ? 'ml-6' : ''}`}
          onClick={() => handleEditTag(item)}
        >
          <div className="flex items-center gap-3">
            <TagBadge tag={item} size="sm" />
            <span className="text-sm text-gray-500">
              {item.usage_count || 0} 张截图
            </span>
          </div>
          <span className="text-xs text-gray-400">点击编辑</span>
        </div>
        {item.children && item.children.length > 0 && renderHierarchy(item.children, level + 1)}
      </div>
    ))
  }

  const tabs = [
    { id: 'cloud', label: '标签云' },
    { id: 'list', label: '标签列表' },
    { id: 'hierarchy', label: '层级结构' },
    { id: 'trends', label: '趋势分析' },
    { id: 'rules', label: '规则管理' }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">标签管理</h2>
          <p className="text-sm text-gray-500 mt-1">管理和配置自动标签系统</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAutoTagAll}
            disabled={isAutoTagging}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm transition-colors"
          >
            {isAutoTagging ? '处理中...' : '批量自动打标签'}
          </button>
          <button
            onClick={handleCreateTag}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
          >
            + 创建标签
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'cloud' && (
            <TagCloud
              tags={tags}
              onTagClick={(tag) => handleEditTag(tag)}
              maxTags={100}
            />
          )}

          {activeTab === 'list' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tags.map(tag => (
                <div
                  key={tag.id}
                  onClick={() => handleEditTag(tag)}
                  className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <TagBadge tag={tag} size="md" />
                    <span className="text-xs text-gray-400">{tag.usage_count || 0}</span>
                  </div>
                  {tag.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{tag.description}</p>
                  )}
                  {tag.synonyms && tag.synonyms.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      同义词: {tag.synonyms.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'hierarchy' && (
            <div className="space-y-1">
              {hierarchy.length > 0 ? (
                renderHierarchy(hierarchy)
              ) : (
                <div className="text-center py-12 text-gray-400">
                  暂无层级结构，编辑标签时可设置父标签
                </div>
              )}
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">时间范围:</span>
                {[7, 14, 30, 90].map(days => (
                  <button
                    key={days}
                    onClick={() => setTrendDays(days)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      trendDays === days
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {days}天
                  </button>
                ))}
              </div>
              <TagTrendChart trends={trends} days={trendDays} />
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleCreateRule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
                >
                  + 添加规则
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  暂无规则，点击上方按钮创建自定义打标签规则
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map(rule => (
                    <div
                      key={rule.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="w-32">
                        <select
                          value={rule.tag_id}
                          onChange={(e) => handleUpdateRule(rule.id, 'tag_id', parseInt(e.target.value))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {tags.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <select
                          value={rule.rule_type}
                          onChange={(e) => handleUpdateRule(rule.id, 'rule_type', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {RULE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={rule.rule_pattern}
                          onChange={(e) => handleUpdateRule(rule.id, 'rule_pattern', e.target.value)}
                          placeholder="规则模式"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          value={rule.weight}
                          onChange={(e) => handleUpdateRule(rule.id, 'weight', parseFloat(e.target.value))}
                          step="0.1"
                          min="0.1"
                          max="2"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <button
                        onClick={() => handleUpdateRule(rule.id, 'is_active', !rule.is_active)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          rule.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                      >
                        {rule.is_active ? '启用' : '禁用'}
                      </button>

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditor && (
        <TagEditor
          tag={editingTag}
          onClose={() => setShowEditor(false)}
          onSaved={handleTagSaved}
        />
      )}
    </div>
  )
}
