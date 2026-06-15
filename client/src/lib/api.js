import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 0 // unlimited — large file uploads
})

export default api
