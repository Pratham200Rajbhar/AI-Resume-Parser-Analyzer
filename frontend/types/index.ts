export interface User {
  id: string
  email: string
  fullName?: string
  createdAt: string
}

export interface Resume {
  id: string
  userId: string
  fileName: string
  fileType: string
  fileSize: number
  status: UploadStatus
  createdAt: string
  analysis?: ResumeAnalysis
}

export type UploadStatus = 'PENDING' | 'PARSING' | 'ANALYZING' | 'ANALYZED' | 'FAILED'

export interface ResumeAnalysis {
  id: string
  resumeId: string
  atsScore: number
  atsBreakdown: ATSBreakdown
  entitiesJson: ResumeEntities
  biasFlagsJson: BiasFlag[]
  fraudFlagsJson: FraudFlag[]
  createdAt: string
}

export interface ATSBreakdown {
  keywords: number
  format: number
  sections: number
  contact: number
  length: number
  suggestions: string[]
}

export interface ResumeEntities {
  name?: string
  email?: string
  phone?: string
  location?: string
  summary?: string
  skills: Skill[]
  experience: Experience[]
  education: Education[]
  certifications: string[]
  projects: Project[]
}

export interface Skill {
  raw: string
  normalized: string
  onetId?: string
  category?: string
  confidence: number
}

export interface Experience {
  company: string
  role: string
  startDate?: string
  endDate?: string
  description?: string
  durationMonths?: number
}

export interface Education {
  institution: string
  degree?: string
  field?: string
  graduationYear?: number
}

export interface Project {
  name: string
  description?: string
  technologies: string[]
}

export interface BiasFlag {
  type: 'gender' | 'age' | 'personal'
  term: string
  sentence: string
  suggestion: string
}

export interface FraudFlag {
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface JobDescription {
  id: string
  userId: string
  title: string
  company?: string
  rawText: string
  createdAt: string
}

export interface JdMatchResult {
  id: string
  resumeId: string
  jobDescriptionId: string
  matchScore: number
  matchedSkills: string[]
  gapSkills: string[]
  keywordReport: Record<string, number>
  createdAt: string
  jobDescription?: JobDescription
}

export interface BatchJob {
  id: string
  userId: string
  totalCount: number
  completedCount: number
  failedCount: number
  status: 'IN_PROGRESS' | 'COMPLETE' | 'FAILED'
  rankedResults?: RankedCandidate[]
  createdAt: string
}

export interface RankedCandidate {
  rank: number
  resumeId: string
  fileName: string
  compositeScore: number
  atsScore: number
  matchScore: number
  skillsScore: number
  experienceScore: number
  educationScore: number
  entities: ResumeEntities
}

export interface CoachingSession {
  id: string
  userId: string
  title: string
  messages: ChatMessage[]
  resumeAnalysisId?: string
  jobDescriptionId?: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface JobProgressEvent {
  // Backend publishes "type" not "event" — keep both for compatibility
  type:
    | 'JOB_STARTED'
    | 'PARSING_COMPLETE'
    | 'ENTITIES_READY'
    | 'ANALYSIS_READY'
    | 'COMPLETE'
    | 'ERROR'
    | 'PING'
    | string
  job_id?: string
  resume_id?: string
  message?: string
  data?: unknown
  ats_score?: number
  chars?: number
  entity_count?: number
  bias_count?: number
  fraud_count?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType: string
}

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

export interface KanbanCandidate {
  id: string
  resumeId: string
  name: string
  atsScore: number
  matchScore: number
  topSkills: string[]
  notes: string
  column: KanbanColumn
}

export type KanbanColumn = 'shortlisted' | 'under_review' | 'rejected' | 'hired'
