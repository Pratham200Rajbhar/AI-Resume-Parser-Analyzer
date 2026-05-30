'use client'

import { getScoreStrokeColor } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number
  size?: number
  label?: string
}

export function ScoreGauge({ score, size = 120, label = 'Score' }: ScoreGaugeProps) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  // Arc covers 270 degrees (from 135deg to 405deg)
  const arcLength = circumference * 0.75
  const offset = arcLength - (score / 100) * arcLength
  const strokeColor = getScoreStrokeColor(score)
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`${label}: ${score} out of 100`}
        role="img"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={10}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Score arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={10}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold leading-none"
          style={{
            fontSize: size * 0.22,
            color: strokeColor,
          }}
        >
          {score}
        </span>
        <span
          className="text-gray-400 leading-none mt-1"
          style={{ fontSize: size * 0.1 }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
