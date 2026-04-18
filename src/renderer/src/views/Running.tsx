import { useEffect, useRef } from 'react'
import type { AgentEvent } from '../../../../lib/types'

const PHASE_LABELS = ['', 'Planning research', 'Collecting data', 'Synthesizing']
const PHASE_DESC = ['', 'Opus is designing a research strategy', 'Sonnet is searching X & Reddit', 'Opus is writing your hypothesis']

export default function Running({
  prompt,
  events,
  onResult,
}: {
  prompt: string
  events: AgentEvent[]
  onResult: () => void
}) {
  const feedRef = useRef<HTMLDivElement>(null)
  const currentPhase = [...events].reverse().find(e => e.type === 'phase')?.phase ?? 1

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events])

  useEffect(() => {
    if (events.some(e => e.type === 'result')) onResult()
  }, [events])

  const searchEvents = events.filter(e => e.type === 'search') as Extract<AgentEvent, { type: 'search' }>[]
  const totalPosts = searchEvents.reduce((s, e) => s + e.count, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Titlebar */}
      <div className="titlebar flex items-end px-6 pb-3">
        <span className="text-[13px] text-[#6E6E73] truncate max-w-[400px]">"{prompt}"</span>
      </div>

      {/* Phase bar */}
      <div className="px-6 pb-5">
        <div className="flex items-center gap-3">
          {[1, 2, 3].map(p => (
            <div key={p} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all ${
                currentPhase === p
                  ? 'bg-[#0071E3] text-white'
                  : currentPhase > p
                  ? 'bg-[#30D158] text-white'
                  : 'bg-[#E0E0E5] text-[#6E6E73]'
              }`}>
                {currentPhase > p ? '✓' : p}
              </div>
              <span className={`text-[13px] ${currentPhase === p ? 'text-[#1D1D1F] font-medium' : 'text-[#6E6E73]'}`}>
                {PHASE_LABELS[p]}
              </span>
              {p < 3 && <div className="w-8 h-px bg-[#E0E0E5]" />}
            </div>
          ))}
        </div>
        {currentPhase > 0 && (
          <p className="text-[13px] text-[#6E6E73] mt-2 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0071E3] pulse-dot" />
            {PHASE_DESC[currentPhase]}
          </p>
        )}
      </div>

      {/* Stats row */}
      {searchEvents.length > 0 && (
        <div className="flex gap-4 px-6 mb-4">
          {[
            { label: 'Searches', val: searchEvents.length },
            { label: 'Posts collected', val: totalPosts },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl px-4 py-2.5 border border-[#E8E8ED]">
              <div className="text-[20px] font-semibold text-[#1D1D1F]">{s.val}</div>
              <div className="text-[11px] text-[#6E6E73]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Activity feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-6 pb-6 space-y-1.5">
        {events.map((e, i) => <EventRow key={i} event={e} />)}
        {events.length === 0 && (
          <div className="text-[14px] text-[#C7C7CC] text-center pt-12">Starting up…</div>
        )}
      </div>
    </div>
  )
}

function EventRow({ event: e }: { event: AgentEvent }) {
  if (e.type === 'phase') return (
    <div className="flex items-center gap-2 py-2 animate-in">
      <div className="w-px h-4 bg-[#E0E0E5]" />
      <span className="text-[13px] font-semibold text-[#1D1D1F]">{PHASE_LABELS[e.phase]}</span>
    </div>
  )

  if (e.type === 'search') return (
    <div className="flex items-center gap-3 py-1.5 animate-in">
      <PlatformBadge platform={e.platform} />
      <span className="text-[13px] text-[#1D1D1F] flex-1 truncate">{e.query}</span>
      <span className={`text-[12px] font-medium tabular-nums ${e.count > 0 ? 'text-[#30D158]' : 'text-[#C7C7CC]'}`}>
        {e.count} posts
      </span>
    </div>
  )

  if (e.type === 'profile') return (
    <div className="flex items-center gap-3 py-1.5 animate-in">
      <span className="text-[11px] bg-[#F0F0F5] text-[#6E6E73] px-2 py-0.5 rounded-full">profile</span>
      <span className="text-[13px] text-[#1D1D1F]">@{e.username}</span>
      <span className="text-[12px] text-[#30D158] font-medium">{e.count} posts</span>
    </div>
  )

  if (e.type === 'log') return (
    <div className="py-1 animate-in">
      <span className="text-[12px] text-[#6E6E73]">{e.text}</span>
    </div>
  )

  if (e.type === 'error') return (
    <div className="py-2 px-3 bg-[#FFF2F2] rounded-lg border border-[#FFD7D7] animate-in">
      <span className="text-[12px] text-[#FF3B30]">{e.message}</span>
    </div>
  )

  return null
}

function PlatformBadge({ platform }: { platform: 'x' | 'reddit' }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
      platform === 'x'
        ? 'bg-[#1D1D1F] text-white'
        : 'bg-[#FF4500] text-white'
    }`}>
      {platform === 'x' ? 'X' : 'R'}
    </span>
  )
}

const PHASE_LABELS_LOCAL: Record<number, string> = { 1: 'Planning research', 2: 'Collecting data', 3: 'Synthesizing' }
