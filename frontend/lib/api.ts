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
  LearningPlan,
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
          document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
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
          document.cookie = `access_token=${access_token}; path=/; max-age=86400; SameSite=Lax`
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
          document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
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

// -----------------------------------------------------------------------------
// Response shapes for the consolidated feature modules below.
// Responses are camelCased by the interceptor; request bodies stay snake_case.
// -----------------------------------------------------------------------------
export interface AnalyticsSummary {
  totalResumes: number
  avgAtsScore: number
  highestScoreThisMonth: number
  activeCoachingSessions: number
  statusCounts: Record<string, number>
  scoreDistribution: { range: string; count: number }[]
  weeklyTrend: { week: string; avgScore: number | null; count: number }[]
  topSkills: { skill: string; count: number }[]
}

export interface Application {
  id: string
  company: string
  jobTitle: string
  jobDescriptionId: string | null
  resumeId: string | null
  applicationDate: string
  deadline: string | null
  stage: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ApplicationInput {
  company?: string
  jobTitle?: string
  stage?: string
  notes?: string
  deadline?: string
  jobDescriptionId?: string
  resumeId?: string
}

export interface CoverLetter {
  id: string
  resumeId: string
  jobDescriptionId: string | null
  title: string
  content: string
  tone: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface InterviewQuestion {
  category: string
  question: string
  starTemplate: string
}

export interface PracticeFeedback {
  score: number
  clarity: string
  specificity: string
  metricsUsage: string
  improvementNotes: string
}

export interface WorkspaceCandidate {
  id: string
  resumeId: string
  name: string
  atsScore: number
  matchScore: number
  topSkills: string[]
  notes: string
  column: string
  position: number
  jobDescriptionId: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceColumn {
  id: string
  name: string
  slug: string
  position: number
  createdAt: string
}

export interface UserPreferences {
  defaultLlmProvider: string
  defaultExportFormat: string
  emailAnalysisComplete: boolean
  emailBatchDone: boolean
  emailDeadlineReminder: boolean
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

export interface ApiKeyCreated extends ApiKey {
  key: string
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  link: string | null
  createdAt: string
}

export interface SearchResult {
  id: string
  type: string
  title: string
  subtitle: string | null
  href: string
}

export interface SearchResults {
  resumes?: SearchResult[]
  jds?: SearchResult[]
  coaching?: SearchResult[]
  applications?: SearchResult[]
}

export interface ShareLink {
  id: string
  token: string
  visibleSections: string[]
  expiresAt: string | null
  viewCount: number
  createdAt: string
}

export interface Team {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

export interface TeamMember {
  id: string
  userId: string
  teamId: string
  role: string
  createdAt: string
}

export interface TailoredScorePair {
  atsScore: number
  matchScore: number
}

export interface TailoredExperience {
  company: string
  role: string
  rewrittenBullets: string[]
}

export interface TailorResult {
  newResumeId: string
  sourceResumeId: string
  jobDescriptionId: string
  summary: string
  rewrittenExperiences: TailoredExperience[]
  addedKeywords: string[]
  before: TailoredScorePair
  after: TailoredScorePair
}

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

    list: async (page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc', status?: string): Promise<PaginatedResponse<Resume>> => {
      const response = await axiosInstance.get<PaginatedResponse<Resume>>('/resumes', {
        params: { page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder, status },
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

    exportFormat: async (id: string, format: 'json' | 'docx'): Promise<Blob> => {
      const response = await axiosInstance.get(`/resumes/${id}/export`, {
        params: { format },
        responseType: 'blob',
      })
      return response.data
    },

    rewriteBullet: async (id: string, bullet: string): Promise<{ alternatives: { text: string; reason: string }[] }> => {
      const response = await axiosInstance.post(`/resumes/${id}/rewrite-bullet`, { bullet })
      return response.data
    },

    getVersions: async (id: string): Promise<{ id: string; fileName: string; atsScore: number | null; createdAt: string; isCurrent: boolean; parentResumeId: string | null }[]> => {
      const response = await axiosInstance.get(`/resumes/${id}/versions`)
      return response.data
    },
  },

  jds: {
    create: async (title: string, company: string | undefined, rawText: string): Promise<JobDescription> => {
      const response = await axiosInstance.post<JobDescription>('/jds', {
        title,
        company,
        raw_text: rawText,
      })
      return response.data
    },

    list: async (): Promise<JobDescription[]> => {
      const response = await axiosInstance.get<{ items: JobDescription[]; total: number }>('/jds')
      return response.data.items
    },

    get: async (id: string): Promise<JobDescription> => {
      const response = await axiosInstance.get<JobDescription>(`/jds/${id}`)
      return response.data
    },

    update: async (
      id: string,
      input: { title?: string; company?: string; rawText?: string }
    ): Promise<JobDescription> => {
      const response = await axiosInstance.patch<JobDescription>(`/jds/${id}`, {
        title: input.title,
        company: input.company || undefined,
        raw_text: input.rawText,
      })
      return response.data
    },

    getMatches: async (id: string): Promise<JdMatchResult[]> => {
      const response = await axiosInstance.get<JdMatchResult[]>(`/jds/${id}/matches`)
      return response.data
    },

    delete: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/jds/${id}`)
    },

    match: async (jdId: string, resumeId: string): Promise<JdMatchResult> => {
      const response = await axiosInstance.post<JdMatchResult>(`/jds/${jdId}/match/${resumeId}`)
      return response.data
    },

    importUrl: async (url: string): Promise<{ title: string; company: string | null; rawText: string; sourceUrl: string }> => {
      const response = await axiosInstance.post('/jds/import-url', { url })
      return response.data
    },
  },

  batches: {
    create: async (jdId?: string): Promise<BatchJob> => {
      const response = await axiosInstance.post<BatchJob>('/batches', {
        jd_id: jdId ?? null,
      })
      return response.data
    },

    uploadFiles: async (
      batchId: string,
      files: File[],
      jdId?: string,
      onProgress?: (pct: number) => void
    ): Promise<{ batchId: string; accepted: number; jobId: string }> => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (jdId) formData.append('job_description_id', jdId)
      const response = await axiosInstance.post<{ batchId: string; accepted: number; jobId: string }>(`/batches/${batchId}/upload`, formData, {
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

    sendMessageStream: async (
      sessionId: string,
      message: string,
      onChunk: (chunk: string) => void
    ): Promise<void> => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const response = await fetch(`${BASE_URL}/api/v1/coaching/sessions/${sessionId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6)
            try {
              const parsed = JSON.parse(dataStr)
              if (parsed.content) {
                onChunk(parsed.content)
              } else if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.error('Failed to parse SSE line:', trimmed, err)
              }
            }
          }
        }
      }
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

  analytics: {
    summary: async (): Promise<AnalyticsSummary> => {
      const response = await axiosInstance.get<AnalyticsSummary>('/analytics/summary')
      return response.data
    },
  },

  applications: {
    list: async (): Promise<Application[]> => {
      const response = await axiosInstance.get<Application[]>('/applications')
      return response.data
    },

    create: async (input: ApplicationInput): Promise<Application> => {
      const response = await axiosInstance.post<Application>('/applications', {
        company: input.company,
        job_title: input.jobTitle,
        stage: input.stage,
        notes: input.notes,
        deadline: input.deadline || undefined,
        job_description_id: input.jobDescriptionId,
        resume_id: input.resumeId,
      })
      return response.data
    },

    update: async (id: string, input: ApplicationInput): Promise<Application> => {
      const response = await axiosInstance.patch<Application>(`/applications/${id}`, {
        company: input.company,
        job_title: input.jobTitle,
        stage: input.stage,
        notes: input.notes,
        deadline: input.deadline || undefined,
        job_description_id: input.jobDescriptionId,
        resume_id: input.resumeId,
      })
      return response.data
    },

    remove: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/applications/${id}`)
    },
  },

  coverLetters: {
    list: async (): Promise<CoverLetter[]> => {
      const response = await axiosInstance.get<CoverLetter[]>('/cover-letters')
      return response.data
    },

    generate: async (
      resumeId: string,
      jobDescriptionId?: string,
      tone = 'professional',
      wordCount = 300
    ): Promise<CoverLetter> => {
      const response = await axiosInstance.post<CoverLetter>('/cover-letters/generate', {
        resume_id: resumeId,
        job_description_id: jobDescriptionId,
        tone,
        word_count: wordCount,
      })
      return response.data
    },

    update: async (
      id: string,
      input: { content?: string; title?: string; tone?: string }
    ): Promise<CoverLetter> => {
      const response = await axiosInstance.patch<CoverLetter>(`/cover-letters/${id}`, {
        content: input.content,
        title: input.title,
        tone: input.tone,
      })
      return response.data
    },

    remove: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/cover-letters/${id}`)
    },
  },

  interviewPrep: {
    generate: async (resumeId: string, jobDescriptionId?: string): Promise<InterviewQuestion[]> => {
      const response = await axiosInstance.post<InterviewQuestion[]>('/interview-prep/generate', {
        resume_id: resumeId,
        job_description_id: jobDescriptionId,
      })
      return response.data
    },

    practiceFeedback: async (question: string, answer: string): Promise<PracticeFeedback> => {
      const response = await axiosInstance.post<PracticeFeedback>('/interview-prep/practice-feedback', {
        question,
        answer,
      })
      return response.data
    },
  },

  workspace: {
    listCandidates: async (): Promise<WorkspaceCandidate[]> => {
      const response = await axiosInstance.get<WorkspaceCandidate[]>('/workspace/candidates')
      return response.data
    },

    addCandidate: async (input: {
      resumeId: string
      name: string
      atsScore?: number
      matchScore?: number
      topSkills?: string[]
      notes?: string
      column?: string
      position?: number
      jobDescriptionId?: string
    }): Promise<WorkspaceCandidate> => {
      const response = await axiosInstance.post<WorkspaceCandidate>('/workspace/candidates', {
        resume_id: input.resumeId,
        name: input.name,
        ats_score: input.atsScore ?? 0,
        match_score: input.matchScore ?? 0,
        top_skills: input.topSkills ?? [],
        notes: input.notes ?? '',
        column: input.column ?? 'shortlisted',
        position: input.position ?? 0,
        job_description_id: input.jobDescriptionId,
      })
      return response.data
    },

    updateCandidate: async (
      id: string,
      input: { column?: string; notes?: string; position?: number; matchScore?: number }
    ): Promise<WorkspaceCandidate> => {
      const response = await axiosInstance.patch<WorkspaceCandidate>(`/workspace/candidates/${id}`, {
        column: input.column,
        notes: input.notes,
        position: input.position,
        match_score: input.matchScore,
      })
      return response.data
    },

    removeCandidate: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/workspace/candidates/${id}`)
    },

    listColumns: async (): Promise<WorkspaceColumn[]> => {
      const response = await axiosInstance.get<WorkspaceColumn[]>('/workspace/columns')
      return response.data
    },
  },

  settings: {
    updateProfile: async (input: { fullName?: string; avatarUrl?: string }): Promise<User> => {
      const response = await axiosInstance.patch<User>('/auth/me', {
        full_name: input.fullName,
        avatar_url: input.avatarUrl,
      })
      return response.data
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      await axiosInstance.post('/auth/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
    },

    getPreferences: async (): Promise<UserPreferences> => {
      const response = await axiosInstance.get<UserPreferences>('/auth/preferences')
      return response.data
    },

    updatePreferences: async (input: Partial<UserPreferences>): Promise<UserPreferences> => {
      const response = await axiosInstance.patch<UserPreferences>('/auth/preferences', {
        default_llm_provider: input.defaultLlmProvider,
        default_export_format: input.defaultExportFormat,
        email_analysis_complete: input.emailAnalysisComplete,
        email_batch_done: input.emailBatchDone,
        email_deadline_reminder: input.emailDeadlineReminder,
      })
      return response.data
    },

    listApiKeys: async (): Promise<ApiKey[]> => {
      const response = await axiosInstance.get<ApiKey[]>('/auth/api-keys')
      return response.data
    },

    createApiKey: async (name: string): Promise<ApiKeyCreated> => {
      const response = await axiosInstance.post<ApiKeyCreated>('/auth/api-keys', { name })
      return response.data
    },

    deleteApiKey: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/auth/api-keys/${id}`)
    },
  },

  search: {
    query: async (q: string, types?: string): Promise<SearchResults> => {
      const response = await axiosInstance.get<SearchResults>('/search', {
        params: { q, ...(types ? { types } : {}) },
      })
      return response.data
    },
  },

  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const response = await axiosInstance.get<AppNotification[]>('/notifications')
      return response.data
    },

    unreadCount: async (): Promise<number> => {
      const response = await axiosInstance.get<{ count: number }>('/notifications/unread-count')
      return response.data.count
    },

    markRead: async (id: string): Promise<void> => {
      await axiosInstance.patch(`/notifications/${id}/read`)
    },

    markAllRead: async (): Promise<void> => {
      await axiosInstance.patch('/notifications/read-all')
    },
  },

  share: {
    create: async (
      resumeId: string,
      input: { visibleSections?: string[]; password?: string; expiresAt?: string }
    ): Promise<ShareLink> => {
      const response = await axiosInstance.post<ShareLink>(`/share/resumes/${resumeId}`, {
        visible_sections: input.visibleSections ?? [],
        password: input.password,
        expires_at: input.expiresAt,
      })
      return response.data
    },

    list: async (resumeId: string): Promise<ShareLink[]> => {
      const response = await axiosInstance.get<ShareLink[]>(`/share/resumes/${resumeId}`)
      return response.data
    },

    remove: async (resumeId: string, token: string): Promise<void> => {
      await axiosInstance.delete(`/share/resumes/${resumeId}/${token}`)
    },

    getShared: async (token: string, password?: string): Promise<Record<string, unknown>> => {
      const response = await axiosInstance.get(`/share/${token}`, {
        params: password ? { password } : {},
      })
      return response.data
    },
  },

  teams: {
    list: async (): Promise<Team[]> => {
      const response = await axiosInstance.get<Team[]>('/teams')
      return response.data
    },

    create: async (name: string): Promise<Team> => {
      const response = await axiosInstance.post<Team>('/teams', { name })
      return response.data
    },

    remove: async (teamId: string): Promise<void> => {
      await axiosInstance.delete(`/teams/${teamId}`)
    },

    listMembers: async (teamId: string): Promise<TeamMember[]> => {
      const response = await axiosInstance.get<TeamMember[]>(`/teams/${teamId}/members`)
      return response.data
    },

    addMember: async (teamId: string, userId: string, role = 'VIEWER'): Promise<TeamMember> => {
      const response = await axiosInstance.post<TeamMember>(`/teams/${teamId}/members`, {
        user_id: userId,
        role,
      })
      return response.data
    },

    updateMember: async (teamId: string, memberId: string, role: string): Promise<TeamMember> => {
      const response = await axiosInstance.patch<TeamMember>(`/teams/${teamId}/members/${memberId}`, {
        role,
      })
      return response.data
    },

    removeMember: async (teamId: string, memberId: string): Promise<void> => {
      await axiosInstance.delete(`/teams/${teamId}/members/${memberId}`)
    },

    inviteByEmail: async (teamId: string, email: string, role = 'VIEWER'): Promise<TeamMember> => {
      const response = await axiosInstance.post<TeamMember>(`/teams/${teamId}/invite-by-email`, {
        email,
        role,
      })
      return response.data
    },
  },

  tailoring: {
    generate: async (resumeId: string, jobDescriptionId: string): Promise<TailorResult> => {
      const response = await axiosInstance.post<TailorResult>('/tailoring/generate', {
        resume_id: resumeId,
        job_description_id: jobDescriptionId,
      })
      return response.data
    },

    get: async (resumeId: string): Promise<Record<string, unknown>> => {
      const response = await axiosInstance.get(`/tailoring/${resumeId}`)
      return response.data
    },
  },

  learningPlans: {
    generate: async (resumeId: string, jobDescriptionId: string): Promise<LearningPlan> => {
      const response = await axiosInstance.post<LearningPlan>('/learning-plans/generate', {
        resume_id: resumeId,
        job_description_id: jobDescriptionId,
      })
      return response.data
    },

    list: async (): Promise<LearningPlan[]> => {
      const response = await axiosInstance.get<LearningPlan[]>('/learning-plans')
      return response.data
    },

    get: async (planId: string): Promise<LearningPlan> => {
      const response = await axiosInstance.get<LearningPlan>(`/learning-plans/${planId}`)
      return response.data
    },

    remove: async (planId: string): Promise<void> => {
      await axiosInstance.delete(`/learning-plans/${planId}`)
    },
  },

  users: {
    search: async (q: string): Promise<{ id: string; email: string; fullName: string | null }[]> => {
      const response = await axiosInstance.get<{ id: string; email: string; fullName: string | null }[]>('/auth/users/search', {
        params: { q },
      })
      return response.data
    },
  },
}

export default axiosInstance
