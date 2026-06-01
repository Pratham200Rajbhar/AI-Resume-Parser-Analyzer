import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'ResumeAI — Premium AI Resume Analyzer & Coach',
  description: 'An intelligent AI-powered resume parser, ATS scoring analyzer, batch recruiter ranker, and interactive career coach.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased bg-canvas text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
