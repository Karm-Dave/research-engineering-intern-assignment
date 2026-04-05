import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

let activeRequests = 0
const listeners = new Set()

const notify = () => {
  listeners.forEach((fn) => fn(activeRequests))
}

export const onLoadingChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

api.interceptors.request.use(
  (config) => {
    activeRequests += 1
    notify()
    return config
  },
  (error) => {
    activeRequests = Math.max(activeRequests - 1, 0)
    notify()
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(activeRequests - 1, 0)
    notify()
    return response
  },
  (error) => {
    activeRequests = Math.max(activeRequests - 1, 0)
    notify()
    console.error('API error', error)
    return Promise.reject(error)
  }
)

export const getHealth = () => api.get('/health').then((r) => r.data)
export const getStats = () => api.get('/stats').then((r) => r.data)
export const getTimeSeries = (granularity = 'day') =>
  api.get(`/timeseries?granularity=${granularity}`).then((r) => r.data)
export const getTopicTrend = (keyword) =>
  api.get(`/timeseries/topic?keyword=${encodeURIComponent(keyword)}`).then((r) => r.data)
export const getNetwork = (type = 'domain', metric = 'pagerank', topN = 50) =>
  api.get(`/network?type=${type}&metric=${metric}&top_n=${topN}`).then((r) => r.data)
export const getRemoveTopNodeAnalysis = (type = 'domain') =>
  api.get(`/network/remove-top-node?type=${type}`).then((r) => r.data)
export const getClusters = (n = 8) => api.get(`/clusters?n_clusters=${n}`).then((r) => r.data)
export const getEmbeddingsViz = () => api.get('/embeddings-viz').then((r) => r.data)
export const search = (query, topK = 10, filterDomain = null) =>
  api.post('/search', { query, top_k: topK, filter_domain: filterDomain }).then((r) => r.data)
export const chat = (query, queryHistory = []) =>
  api.post('/chat', { query, query_history: queryHistory }).then((r) => r.data)
export const getDomains = () => api.get('/domains').then((r) => r.data)
export const getAuthors = () => api.get('/authors').then((r) => r.data)
export const getPosts = (page = 1, perPage = 20, sortBy = 'score') =>
  api.get(`/posts?page=${page}&per_page=${perPage}&sort_by=${sortBy}`).then((r) => r.data)

export default api
