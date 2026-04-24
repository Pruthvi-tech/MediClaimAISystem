import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('mc_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-logout on 401 (expired token)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mc_token')
      localStorage.removeItem('mc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const sendOTP     = (email)       => api.post('/auth/send-otp',    { email })
export const verifyOTP   = (email, otp, intended_role = 'user') => api.post('/auth/verify-otp', { email, otp, intended_role })
export const getOTPStatus= (email)       => api.get(`/auth/otp-status?email=${encodeURIComponent(email)}`)

// Claims
export const getInsurers     = ()              => api.get('/claims/insurers')
export const uploadDocument  = (formData, onProgress) =>
  api.post('/claims/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
  })
export const submitClaim     = (data)          => api.post('/claims/submit', data)
export const getMyClaims     = ()              => api.get('/claims/my')
export const getClaimsSummary= ()              => api.get('/claims/my/summary')
export const getClaim        = (id)            => api.get(`/claims/${id}`)
export const editClaim       = (id, data)      => api.patch(`/claims/${id}/edit`, data)

// Insurer
export const getInsurerClaims = ()             => api.get('/claims/insurer/all')
export const reviewClaim      = (id, data)     => api.patch(`/claims/${id}/review`, data)
export const startReview      = (id)            => api.patch(`/claims/${id}/start-review`)

// Analytics
export const getAnalytics = () => api.get('/analytics/summary')

export default api