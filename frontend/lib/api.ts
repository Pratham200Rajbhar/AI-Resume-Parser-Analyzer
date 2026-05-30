import axios, { AxiosInstance, AxiosProgressEvent, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import type {
  AuthTokens,
  User,
  Resume,
  ResumeAnalysis,
  JobDescription,
  JdMatchResult,
  BatchJob,
  RankedCandidate,
  CoachingSession,
  ChatMessage,
  PaginatedResponse,
} from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const API_BASE = `${BASE_URL}/api/v1`

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        snakeToCamel(k),
        transformKeys(v),
      ])
    )
  }
  return obj
}

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error: unknown) => Promise.reject(error)
)

axiosInstance.interceptors.response.use(
  (response) => {
    response.data = transformKeys(response.data)
    return response
  },
  async (error: unknown) => {
    const axiosError = error as { config?: AxiosRequestConfig & { _retry?: boolean }; response?: { status: number } }
    const originalRequest = axiosError.config as AxiosRequestConfig & { _retry?: boolean }

    if (axiosError.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`
            }
            return axiosInstance(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null

      if (!refreshToken) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      try {
        const response = await axios.post<{ access_token: string; token_type: string }>(
          `${API_BASE}/auth/refresh`,
          { refresh_token: refreshToken }
        )
        const { access_token } = response.data

        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access_token)
        }

        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        processQueue(null, access_token)

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`
        }
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export const api = {
  auth: {
    register: async (email: string, password: string, fullName?: string): Promise<AuthTokens> => {
      const response = await axiosInstance.post<AuthTokens>('/auth/register', {
        email,
        password,
        full_name: fullName,
      })
      return response.data
    },

    login: async (email: string, password: string): Promise<AuthTokens> => {
      const response = await axiosInstance.post<AuthTokens>('/auth/login', { email, password })
      return response.data
    },

    refresh: async (refreshToken: string): Promise<AuthTokens> => {
      const response = await axiosInstance.post<AuthTokens>('/auth/refresh', {
        refresh_token: refreshToken,
      })
      return response.data
    },

    me: async (): Promise<User> => {
      const response = await axiosInstance.get<User>('/auth/me')
      return response.data
    },
  },

  resumes: {
    upload: async (
      file: File,
      onProgress?: (pct: number) => void
    ): Promise<{ jobId: string; resumeId: string }> => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await axiosInstance.post<{ jobId: string; resumeId: string }>(
        '/resumes/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total && onProgress) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(pct)
            }
          },
        }
      )
      return response.data
    },

    list: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Resume>> => {
      const response = await axiosInstance.get<PaginatedResponse<Resume>>('/resumes', {
        params: { page, page_size: pageSize },
      })
      return response.data
    },

    get: async (id: string): Promise<Resume> => {
      const response = await axiosInstance.get<Resume>(`/resumes/${id}`)
      return response.data
    },

    getAnalysis: async (id: string): Promise<ResumeAnalysis> => {
      const response = await axiosInstance.get<ResumeAnalysis>(`/resumes/${id}/analysis`)
      return response.data
    },

    delete: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/resumes/${id}`)
    },

    exportPdf: async (id: string): Promise<Blob> => {
      const response = await axiosInstance.get(`/resumes/${id}/export/pdf`, {
        responseType: 'blob',
      })
      return response.data
    },
  },

  jds: {
    create: async (title: string, company: string | undefined, rawText: string): Promise<JobDescription> => {
      const response = await axiosInstance.post<JobDescription>('/jds/', {
        title,
        company,
        raw_text: rawText,
      })
      return response.data
    },

    list: async (): Promise<JobDescription[]> => {
      const response = await axiosInstance.get<{ items: JobDescription[]; total: number }>('/jds/')
      return response.data.items
    },

    get: async (id: string): Promise<JobDescription> => {
      const response = await axiosInstance.get<JobDescription>(`/jds/${id}`)
      return response.data
    },

    delete: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/jds/${id}`)
    },

    match: async (jdId: string, resumeId: string): Promise<JdMatchResult> => {
      const response = await axiosInstance.post<JdMatchResult>(`/jds/${jdId}/match/${resumeId}`)
      return response.data
    },
  },

  batches: {
    create: async (jdId?: string): Promise<BatchJob> => {
      const response = await axiosInstance.post<BatchJob>('/batches/', {
        jd_id: jdId ?? null,
      })
      return response.data
    },

    uploadFiles: async (
      batchId: string,
      files: File[],
      jdId?: string,
      onProgress?: (pct: number) => void
    ): Promise<BatchJob> => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (jdId) formData.append('job_description_id', jdId)
      const response = await axiosInstance.post<BatchJob>(`/batches/${batchId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total && onProgress) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(pct)
          }
        },
      })
      return response.data
    },

    getStatus: async (id: string): Promise<BatchJob> => {
      const response = await axiosInstance.get<BatchJob>(`/batches/${id}`)
      return response.data
    },

    getRankings: async (id: string): Promise<RankedCandidate[]> => {
      const response = await axiosInstance.get<{ batchId: string; rankings: RankedCandidate[] }>(`/batches/${id}/rankings`)
      return response.data.rankings
    },

    exportCsv: async (id: string): Promise<Blob> => {
      const response = await axiosInstance.get(`/batches/${id}/export/csv`, {
        responseType: 'blob',
      })
      return response.data
    },

    list: async (): Promise<BatchJob[]> => {
      const response = await axiosInstance.get<BatchJob[]>('/batches')
      return response.data
    },
  },

  coaching: {
    createSession: async (
      title: string,
      resumeId?: string,
      jdId?: string
    ): Promise<CoachingSession> => {
      const response = await axiosInstance.post<CoachingSession>('/coaching/sessions', {
        title,
        resume_id: resumeId,
        jd_id: jdId,
      })
      return response.data
    },

    listSessions: async (): Promise<CoachingSession[]> => {
      const response = await axiosInstance.get<{ items: CoachingSession[]; total: number }>('/coaching/sessions')
      return response.data.items
    },

    getSession: async (id: string): Promise<CoachingSession> => {
      const response = await axiosInstance.get<CoachingSession>(`/coaching/sessions/${id}`)
      return response.data
    },

    sendMessage: async (sessionId: string, message: string): Promise<ChatMessage> => {
      const response = await axiosInstance.post<ChatMessage>(
        `/coaching/sessions/${sessionId}/messages`,
        { message }
      )
      return response.data
    },

    updateSession: async (sessionId: string, title: string): Promise<CoachingSession> => {
      const response = await axiosInstance.patch<CoachingSession>(
        `/coaching/sessions/${sessionId}`,
        { title }
      )
      return response.data
    },

    deleteSession: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/coaching/sessions/${id}`)
    },
  },
}

export default axiosInstance
