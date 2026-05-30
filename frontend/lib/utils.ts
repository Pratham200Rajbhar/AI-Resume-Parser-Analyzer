import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { UploadStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatScore(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-500'
}

export function getScoreBgColor(score: number): string {
  if (score >= 75) return 'bg-green-100 text-green-800'
  if (score >= 50) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

export function getScoreStrokeColor(score: number): string {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
}

export function getStatusColor(status: UploadStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-gray-100 text-gray-700'
    case 'PARSING':
      return 'bg-blue-100 text-blue-700'
    case 'ANALYZING':
      return 'bg-indigo-100 text-indigo-700'
    case 'ANALYZED':
      return 'bg-green-100 text-green-700'
    case 'FAILED':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function getStatusLabel(status: UploadStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending'
    case 'PARSING':
      return 'Parsing'
    case 'ANALYZING':
      return 'Analyzing'
    case 'ANALYZED':
      return 'Analyzed'
    case 'FAILED':
      return 'Failed'
    default:
      return status
  }
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return 'bg-yellow-100 text-yellow-800'
    case 'medium':
      return 'bg-orange-100 text-orange-800'
    case 'high':
      return 'bg-red-100 text-red-800'
  }
}
