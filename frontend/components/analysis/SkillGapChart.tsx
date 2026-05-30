'use client'

import type { JdMatchResult } from '@/types'
import { ScoreGauge } from './ScoreGauge'

interface SkillGapChartProps {
  matchResult: JdMatchResult
}

export function SkillGapChart({ matchResult }: SkillGapChartProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <ScoreGauge score={Math.round(matchResult.matchScore)} size={100} label="Match" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-gray-900">
            {matchResult.jobDescription?.title ?? 'Job Match'}
          </p>
          {matchResult.jobDescription?.company && (
            <p className="text-xs text-gray-500">{matchResult.jobDescription.company}</p>
          )}
          <p className="text-xs text-gray-400">
            {matchResult.matchedSkills.length} matched ·{' '}
            {matchResult.gapSkills.length} gaps
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
            Matched Skills ({matchResult.matchedSkills.length})
          </p>
          {matchResult.matchedSkills.length === 0 ? (
            <p className="text-xs text-gray-400">No matched skills</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {matchResult.matchedSkills.map((skill, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
            Skill Gaps ({matchResult.gapSkills.length})
          </p>
          {matchResult.gapSkills.length === 0 ? (
            <p className="text-xs text-gray-400">No skill gaps — great match!</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {matchResult.gapSkills.map((skill, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {Object.keys(matchResult.keywordReport).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Keyword Frequency
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(matchResult.keywordReport)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 15)
              .map(([keyword, count]) => (
                <span
                  key={keyword}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                >
                  {keyword}
                  <span className="ml-1 text-gray-400">×{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
