'use client';

import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Source = { text?: string; page?: number; source?: string; score?: number };
type Theme = 'system' | 'light' | 'dark';

const SUGGESTED_PROMPTS = [
  { label: 'Hope Diamond', text: 'What is the Hope Diamond?' },
  { label: 'Sapphire ID', text: 'How do you identify a sapphire?' },
  { label: 'Montana gems', text: 'What gemstones are found in Montana?' },
  { label: 'Gem vs mineral', text: 'What makes a mineral a gemstone?' },
];

function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') setThemeState(saved);
    setMounted(true);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else if (t === 'light') {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      localStorage.removeItem('theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  const cycle = useCallback(() => {
    setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system');
  }, [theme, setTheme]);

  return { theme, cycle, mounted };
}

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, status, error, setInput, setMessages } = useChat({
    api: '/api/chat',
  });
  const { theme, cycle, mounted } = useTheme();
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* New Chat Confirmation Modal */}
      {showNewChatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewChatConfirm(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full mx-4 animate-modal-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Start new chat?</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              This will clear the current conversation. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNewChatConfirm(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMessages([]);
                  setShowNewChatConfirm(false);
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm"
              >
                New chat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-lg">💎</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">GemAI</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">Gemstone knowledge assistant</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setShowNewChatConfirm(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="New chat"
              aria-label="Start a new chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          )}
          {mounted && (
            <button
              onClick={cycle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={`Theme: ${theme}`}
              aria-label={`Switch theme (currently ${theme})`}
            >
              {theme === 'light' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              ) : theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                </svg>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center pt-20 pb-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-200 dark:shadow-teal-900/40 mb-6">
                <span className="text-4xl">💎</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
                Welcome to GemAI
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-10 leading-relaxed">
                Ask me about gemstone properties, identification, history, and occurrences.
                Answers are grounded in USGS and Smithsonian sources.
              </p>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Try asking
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.text}
                    onClick={() => setInput(p.text)}
                    className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-left hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm transition-all"
                  >
                    <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">{p.label}</span>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors">{p.text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-5">
              {messages.map((m) => (
                <li key={m.id}>
                  {m.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-br-md bg-teal-600 text-white px-4 py-2.5 max-w-[80%] shadow-sm">
                        <p>{m.content}</p>
                      </div>
                    </div>
                  ) : m.content ? (
                    <div className="flex justify-start flex-col items-start gap-2">
                      <div className="rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 px-4 py-3 max-w-[85%] shadow-sm prose prose-sm prose-slate dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-teal-600 dark:prose-a:text-teal-400 max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>

                      {m.toolInvocations?.map(
                        (inv) =>
                          inv.state === 'result' &&
                          inv.toolName === 'getInformation' && (
                            <details
                              key={inv.toolCallId}
                              className="max-w-[85%] w-full"
                            >
                              <summary className="cursor-pointer text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                {(inv.result as Source[]).length} sources
                              </summary>
                              <div className="mt-2 space-y-1.5">
                                {(inv.result as Source[]).map((src, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 p-3"
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 rounded-md px-1.5 py-0.5 uppercase tracking-wide">
                                        p.{src.page ?? '?'}
                                      </span>
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex-1">
                                        {src.source ?? 'unknown'}
                                      </span>
                                      {typeof src.score === 'number' && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                                          {(src.score * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                                      {src.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ),
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
              {(status === 'streaming' || status === 'submitted') && !messages.at(-1)?.content && (
                <li className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </li>
              )}
              {error && (
                <li className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl px-4 py-3">
                  Error: {error.message}
                </li>
              )}
            </ul>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky bottom-0">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 sm:px-6 py-3">
          <div className="flex gap-2 items-center">
            <input
              value={input}
              onChange={handleInputChange}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 dark:focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              placeholder="Ask about gemstones..."
              disabled={status === 'streaming' || status === 'submitted'}
            />
            <button
              type="submit"
              disabled={!input || status === 'streaming' || status === 'submitted'}
              className="rounded-xl bg-teal-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-teal-700 active:bg-teal-800 disabled:opacity-40 disabled:hover:bg-teal-600 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5">
            GemAI can make mistakes. Answers are based on USGS and Smithsonian publications.
          </p>
        </form>
      </footer>
    </div>
  );
}
