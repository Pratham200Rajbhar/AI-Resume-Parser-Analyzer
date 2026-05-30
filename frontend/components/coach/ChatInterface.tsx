'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/types'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import { Send, Bot, User } from 'lucide-react'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  onSend: (content: string) => Promise<void>
  isLoading: boolean
  quickActionInput?: string
  onQuickActionConsumed?: () => void
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-indigo-600" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
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
    <div className={cn('flex items-end gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-indigo-600' : 'bg-indigo-100'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-indigo-600" />
        )}
      </div>
      <div className={cn('max-w-[75%] space-y-1', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 text-white rounded-br-sm whitespace-pre-wrap'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <div
              className="prose prose-sm max-w-none text-gray-900 break-words space-y-2
                [&>p]:leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0
                [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>ul]:mb-2
                [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:space-y-1 [&>ol]:mb-2
                [&>li]:text-sm
                [&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-3 [&>h1]:mb-1
                [&>h2]:text-sm [&>h2]:font-bold [&>h2]:mt-3 [&>h2]:mb-1
                [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1
                [&>code]:bg-gray-200 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>code]:font-mono
                [&>pre]:bg-gray-800 [&>pre]:text-gray-100 [&>pre]:p-3 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:my-2
                [&>pre>code]:bg-transparent [&>pre>code]:p-0 [&>pre>code]:text-xs
                [&>blockquote]:border-l-4 [&>blockquote]:border-gray-300 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-gray-600
                [&>hr]:border-gray-200 [&>hr]:my-2
              "
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot className="w-10 h-10 text-indigo-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">Start the conversation</p>
            <p className="text-xs text-gray-400 mt-1">
              Ask for resume feedback, cover letter help, or interview prep
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

      {/* Input */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none min-h-[24px] max-h-[120px]"
            disabled={isLoading}
            aria-label="Chat message input"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 h-8 w-8 p-0 rounded-lg"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
