import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const getUrls = () => api.get('/urls')
export const addUrl = (data) => api.post('/urls', data)
export const deleteUrl = (id) => api.delete(`/urls/${id}`)
export const updateUrl = (id, data) => api.put(`/urls/${id}`, data)
export const getUrl = (id) => api.get(`/urls/${id}`)
export const getScreenshots = (urlId) => api.get(`/urls/${urlId}/screenshots`)
export const deleteScreenshot = (id) => api.delete(`/screenshots/${id}`)
export const triggerScreenshot = (urlId) => api.post(`/urls/${urlId}/screenshot`)

export const getAllScreenshots = (params) => api.get('/screenshots', { params })
export const getScreenshotTags = (id) => api.get(`/screenshots/${id}/tags`)
export const addScreenshotTag = (id, data) => api.post(`/screenshots/${id}/tags`, data)
export const removeScreenshotTag = (id, tagId, data) => api.delete(`/screenshots/${id}/tags/${tagId}`, { data })
export const retagScreenshot = (id) => api.post(`/screenshots/${id}/retag`)
export const previewScreenshotTags = (id) => api.get(`/screenshots/${id}/preview-tags`)

export const getTags = (params) => api.get('/tags', { params })
export const getTagHierarchy = () => api.get('/tags/hierarchy')
export const getTagTrends = (days) => api.get('/tags/trends', { params: { days } })
export const getPopularTags = (limit) => api.get('/tags/popular', { params: { limit } })
export const createTag = (data) => api.post('/tags', data)
export const updateTag = (id, data) => api.put(`/tags/${id}`, data)
export const deleteTag = (id) => api.delete(`/tags/${id}`)

export const addTagSynonym = (id, data) => api.post(`/tags/${id}/synonyms`, data)
export const removeTagSynonym = (id, synonym) => api.delete(`/tags/${id}/synonyms/${synonym}`)

export const getTagRules = () => api.get('/tags/rules')
export const createTagRule = (data) => api.post('/tags/rules', data)
export const updateTagRule = (id, data) => api.put(`/tags/rules/${id}`, data)
export const deleteTagRule = (id) => api.delete(`/tags/rules/${id}`)

export const autoTagAll = () => api.post('/tags/auto-tag-all')

export default api
