'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, Bot, User, Sparkles } from 'lucide-react'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  onSend: (content: string) => Promise<void>
  isLoading: boolean
  quickActionInput?: string
  onQuickActionConsumed?: () => void
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3.5 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="glass rounded-2xl px-5 py-3 border border-white/5">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-blue-500/80 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-blue-500/80 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-blue-500/80 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (!isUser && !message.content) {
    return null
  }

  return (
    <div className={cn('flex items-start gap-3.5 py-1', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border',
          isUser
            ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
            : 'glass border-white/5 text-blue-400 shadow-sm'
        )}
      >
        {isUser ? (
          <User className="w-4.5 h-4.5" />
        ) : (
          <Bot className="w-4.5 h-4.5" />
        )}
      </div>
      <div className={cn('max-w-[78%] space-y-1.5', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'px-5 py-3 rounded-2xl text-sm leading-relaxed font-sans shadow-none',
            isUser
              ? 'bg-blue-600/15 border border-blue-500/20 text-slate-100 rounded-tr-none whitespace-pre-wrap'
              : 'bg-transparent text-foreground border-none px-1'
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <div
              className="prose prose-sm max-w-none text-foreground break-words space-y-2.5 font-normal
                [&>p]:leading-relaxed [&>p]:mb-2.5 [&>p:last-child]:mb-0
                [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1.5 [&>ul]:mb-2.5
                [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1.5 [&>ol]:mb-2.5
                [&>li]:text-sm [&>li]:text-gray-800 dark:[&>li]:text-gray-200
                [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mt-4 [&>h1]:mb-1.5 [&>h1]:font-display
                [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3.5 [&>h2]:mb-1.5 [&>h2]:font-display
                [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-3 [&>h3]:mb-1 [&>h3]:font-display
                [&>code]:bg-muted dark:[&>code]:bg-slate-800 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>code]:font-mono [&>code]:text-blue-600 dark:[&>code]:text-blue-400
                [&>pre]:bg-gray-900 [&>pre]:text-gray-100 [&>pre]:p-4 [&>pre]:rounded-2xl [&>pre]:overflow-x-auto [&>pre]:my-3 [&>pre]:border [&>pre]:border-gray-800
                [&>pre>code]:bg-transparent [&>pre>code]:p-0 [&>pre>code]:text-xs [&>pre>code]:text-gray-200
                [&>blockquote]:border-l-4 [&>blockquote]:border-blue-200 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-500 dark:[&>blockquote]:text-gray-400
                [&>hr]:border-border [&>hr]:my-3
              "
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 font-medium px-2.5 font-sans">
          {new Date(message.timestamp ?? new Date()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}

export function ChatInterface({
  messages,
  onSend,
  isLoading,
  quickActionInput,
  onQuickActionConsumed,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Handle quick action input
  useEffect(() => {
    if (quickActionInput) {
      setInput(quickActionInput)
      textareaRef.current?.focus()
      onQuickActionConsumed?.()
    }
  }, [quickActionInput, onQuickActionConsumed])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
    }
  }, [input])

  async function handleSend() {
    const content = input.trim()
    if (!content || isLoading) return
    setInput('')
    await onSend(content)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full glass-card border border-white/5 shadow-lg overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 max-w-sm mx-auto">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mb-4 border border-blue-100/60 dark:border-blue-900/20 text-blue-600 dark:text-blue-400">
              <Bot className="w-7 h-7" />
            </div>
            <h3 className="font-display text-sm font-semibold text-foreground">AI Career Coach Session</h3>
            <p className="text-xs text-muted-foreground mt-1 font-sans leading-relaxed">
              Ask for active resume updates, cover letter formulations, behavioral mocks, or industry salary trends.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
        )}
        {isLoading && (
          messages.length === 0 ||
          messages[messages.length - 1].role === 'user' ||
          (messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content)
        ) && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock */}
      <div className="p-4 border-t border-white/5 bg-transparent">
        <div className="flex items-end gap-2 bg-white/5 hover:bg-white/10 dark:bg-slate-950/45 rounded-2xl border border-white/5 hover:border-white/10 focus-within:border-blue-500/40 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all duration-200 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[22px] max-h-[120px] font-sans font-normal leading-relaxed"
            disabled={isLoading}
            aria-label="Chat message input"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 h-8.5 w-8.5 p-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right font-medium font-sans px-2 select-none">
          Press Enter to send · Shift + Enter for newline
        </p>
      </div>
    </div>
  )
}
