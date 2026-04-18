import { useState } from 'react'

export default function Home({
  onStart,
  onSettings,
}: {
  onStart: (prompt: string, platforms: ('x' | 'reddit')[]) => void
  onSettings: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [platforms, setPlatforms] = useState<Set<'x' | 'reddit'>>(new Set(['x']))

  function togglePlatform(p: 'x' | 'reddit') {
    setPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(p) && next.size > 1) next.delete(p)
      else next.add(p)
      return next
    })
  }

  function submit() {
    if (!prompt.trim()) return
    onStart(prompt.trim(), [...platforms])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Titlebar */}
      <div className="titlebar flex items-end justify-end px-5 pb-3">
        <button onClick={onSettings} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#E8E8ED] transition-colors">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#6E6E73" strokeWidth="1.5">
            <circle cx="10" cy="10" r="3"/>
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.22 3.22l1.42 1.42M15.36 15.36l1.42 1.42M3.22 16.78l1.42-1.42M15.36 4.64l1.42-1.42"/>
          </svg>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 animate-in">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1D1D1F] mx-auto mb-5 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7"/>
              <path d="m21 21-4.35-4.35"/>
              <path d="M7 11h8M11 7v8"/>
            </svg>
          </div>
          <h1 className="text-[34px] font-semibold tracking-tight text-[#1D1D1F]">NicheScout</h1>
          <p className="text-[15px] text-[#6E6E73] mt-1">AI-powered market research for solopreneurs</p>
        </div>

        {/* Input */}
        <div className="w-full max-w-xl">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
              placeholder="What market should I build in?&#10;e.g. &quot;AI tools for indie hackers&quot; or &quot;productivity for remote teams&quot;"
              rows={3}
              className="w-full px-5 py-4 rounded-2xl bg-white border border-[#E0E0E5] text-[15px] text-[#1D1D1F] placeholder-[#C7C7CC] outline-none focus:border-[#0071E3] transition-colors resize-none shadow-sm"
            />
          </div>

          {/* Platform toggles */}
          <div className="flex items-center gap-2 mt-3 mb-5">
            <span className="text-[13px] text-[#6E6E73]">Search on</span>
            {(['x', 'reddit'] as const).map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all border ${
                  platforms.has(p)
                    ? 'bg-[#1D1D1F] text-white border-transparent'
                    : 'bg-white text-[#6E6E73] border-[#E0E0E5]'
                }`}
              >
                {p === 'x' ? 'X (Twitter)' : 'Reddit'}
              </button>
            ))}
          </div>

          <button
            onClick={submit}
            disabled={!prompt.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-[15px] bg-[#0071E3] text-white transition-all hover:bg-[#0077ED] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            Start Research →
          </button>
          <p className="text-center text-[12px] text-[#C7C7CC] mt-3">⌘↵ to start</p>
        </div>
      </div>
    </div>
  )
}
