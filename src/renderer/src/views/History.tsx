import { useState, useEffect } from 'react'
import type { ResearchResult } from '../../../../lib/types'

const api = (window as any).api

const CONFIDENCE_COLOR = { low: '#FF9500', medium: '#0071E3', high: '#30D158' }
const CONFIDENCE_BG    = { low: '#FFF6E8', medium: '#EEF5FF', high: '#EDFBF1' }

type HistoryItem = { id: string; prompt: string; date: string; confidence: 'low' | 'medium' | 'high' }

export default function History({ onBack, onOpen }: { onBack: () => void; onOpen: (r: ResearchResult) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listHistory().then((list: HistoryItem[]) => { setItems(list); setLoading(false) })
  }, [])

  async function open(id: string) {
    const result = await api.getHistory(id)
    if (result) onOpen(result)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="titlebar flex items-end justify-between px-6 pb-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-[#0071E3] font-medium">
          <svg width="8" height="12" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 1L1 7l6 6"/></svg>
          Back
        </button>
        <span className="text-[13px] text-[#6E6E73]">Past Research</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <p className="text-center text-[13px] text-[#6E6E73] mt-16">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-[13px] text-[#6E6E73] mt-16">No past research yet.</p>
        ) : (
          <div className="space-y-2 animate-in">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => open(item.id)}
                className="w-full text-left bg-white rounded-2xl p-5 border border-[#E8E8ED] hover:border-[#0071E3] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-medium text-[#1D1D1F] leading-snug">{item.prompt}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                    style={{ color: CONFIDENCE_COLOR[item.confidence], background: CONFIDENCE_BG[item.confidence] }}>
                    {item.confidence.toUpperCase()}
                  </span>
                </div>
                <p className="text-[12px] text-[#6E6E73] mt-1.5">{item.date}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
