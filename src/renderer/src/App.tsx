import { useState, useEffect } from 'react'
import Home from './views/Home'
import Running from './views/Running'
import Results from './views/Results'
import Settings from './views/Settings'
import type { AgentEvent, ResearchResult } from '../../../lib/types'

type View = 'home' | 'running' | 'results' | 'settings'

const api = (window as any).api

export default function App() {
  const [view, setView] = useState<View>('home')
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [hasCreds, setHasCreds] = useState(false)

  useEffect(() => {
    api.hasCreds().then((has: boolean) => {
      setHasCreds(has)
      if (!has) setView('settings')
    })
  }, [])

  useEffect(() => {
    api.onEvent((e: AgentEvent) => {
      setEvents(prev => [...prev, e])
      if (e.type === 'result') setResult(e.data)
    })
    return () => api.offEvents()
  }, [])

  function startResearch(p: string, platforms: ('x' | 'reddit')[]) {
    setPrompt(p)
    setEvents([])
    setResult(null)
    setView('running')
    api.startResearch(p, platforms)
  }

  useEffect(() => {
    if (result) setView('results')
  }, [result])

  return (
    <div className="h-screen flex flex-col bg-[#F5F5F7]">
      {view === 'settings' && (
        <Settings onSave={() => { setHasCreds(true); setView('home') }} onBack={hasCreds ? () => setView('home') : undefined} />
      )}
      {view === 'home' && (
        <Home onStart={startResearch} onSettings={() => setView('settings')} />
      )}
      {view === 'running' && (
        <Running prompt={prompt} events={events} onResult={() => result && setView('results')} />
      )}
      {view === 'results' && result && (
        <Results result={result} onBack={() => setView('home')} />
      )}
    </div>
  )
}
