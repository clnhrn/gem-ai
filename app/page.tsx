'use client';

import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Source = { text?: string; page?: number; source?: string; score?: number };

const SUGGESTED_PROMPTS = [
  { label: 'Hope Diamond', text: 'What is the Hope Diamond?' },
  { label: 'Sapphire ID', text: 'How do you identify a sapphire?' },
  { label: 'Montana gems', text: 'What gemstones are found in Montana?' },
  { label: 'Gem vs mineral', text: 'What makes a mineral a gemstone?' },
];

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, status, error, setInput } = useChat({
    api: '/api/chat',
  });

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-lg">💎</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">GemAI</h1>
            <p className="text-[11px] text-slate-400 leading-tight">Gemstone knowledge assistant</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center pt-20 pb-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-200 mb-6">
                <span className="text-4xl">💎</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">
                Welcome to GemAI
              </h2>
              <p className="text-slate-500 max-w-sm mb-10 leading-relaxed">
                Ask me about gemstone properties, identification, history, and occurrences.
                Answers are grounded in USGS and Smithsonian sources.
              </p>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                Try asking
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.text}
                    onClick={() => setInput(p.text)}
                    className="group rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-teal-300 hover:shadow-sm transition-all"
                  >
                    <span className="text-xs text-teal-600 font-medium">{p.label}</span>
                    <p className="text-sm text-slate-600 mt-0.5 group-hover:text-slate-800 transition-colors">{p.text}</p>
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
                  ) : (
                    <div className="flex justify-start flex-col items-start gap-2">
                      <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200/80 px-4 py-3 max-w-[85%] shadow-sm prose prose-sm prose-slate prose-headings:font-semibold prose-headings:text-slate-800 prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-strong:text-slate-800 prose-a:text-teal-600 max-w-none">
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
                              <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-teal-600 transition-colors flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                {(inv.result as Source[]).length} sources
                              </summary>
                              <div className="mt-2 space-y-1.5">
                                {(inv.result as Source[]).map((src, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg bg-slate-50/80 border border-slate-100 p-3"
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 rounded-md px-1.5 py-0.5 uppercase tracking-wide">
                                        p.{src.page ?? '?'}
                                      </span>
                                      <span className="text-[11px] text-slate-400 truncate flex-1">
                                        {src.source ?? 'unknown'}
                                      </span>
                                      {typeof src.score === 'number' && (
                                        <span className="text-[10px] text-slate-400 tabular-nums">
                                          {(src.score * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                                      {src.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ),
                      )}
                    </div>
                  )}
                </li>
              ))}
              {(status === 'streaming' || status === 'submitted') && !messages.at(-1)?.content && (
                <li className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200/80 px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </li>
              )}
              {error && (
                <li className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  Error: {error.message}
                </li>
              )}
            </ul>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur-md sticky bottom-0">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 sm:px-6 py-3">
          <div className="flex gap-2 items-center">
            <input
              value={input}
              onChange={handleInputChange}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 focus:bg-white placeholder:text-slate-400 transition-all"
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
          <p className="text-[10px] text-slate-400 text-center mt-1.5">
            GemAI can make mistakes. Answers are based on USGS and Smithsonian publications.
          </p>
        </form>
      </footer>
    </div>
  );
}
