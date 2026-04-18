import { useState, useEffect } from 'react'

const api = (window as any).api

export default function Settings({ onSave, onBack }: { onSave: () => void; onBack?: () => void }) {
  const [x, setX] = useState({ username: '', password: '' })
  const [reddit, setReddit] = useState({ username: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getCreds().then((creds: any) => {
      if (creds) {
        setX(creds.x || { username: '', password: '' })
        setReddit(creds.reddit || { username: '', password: '' })
      }
    })
  }, [])

  async function save() {
    setSaving(true)
    await api.saveCreds({ x, reddit })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onSave() }, 800)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="titlebar flex items-end px-6 pb-3 justify-between">
        <span className="text-[13px] text-[#6E6E73]">Settings</span>
        {onBack && (
          <button onClick={onBack} className="text-[13px] text-[#0071E3] font-medium -webkit-app-region-no-drag">
            Done
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 animate-in">
        <h1 className="text-[28px] font-semibold text-[#1D1D1F] mb-1">Credentials</h1>
        <p className="text-[15px] text-[#6E6E73] mb-8">Stored securely in your system keychain.</p>

        {/* X */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-[#1D1D1F] rounded-[5px] flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.213 5.567 5.95-5.567Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <span className="text-[17px] font-semibold">X (Twitter)</span>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username or email"
              value={x.username}
              onChange={e => setX(p => ({ ...p, username: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#E0E0E5] text-[15px] outline-none focus:border-[#0071E3] transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={x.password}
              onChange={e => setX(p => ({ ...p, password: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#E0E0E5] text-[15px] outline-none focus:border-[#0071E3] transition-colors"
            />
          </div>
        </div>

        {/* Reddit */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-[#FF4500] rounded-[5px] flex items-center justify-center">
              <svg width="12" height="10" viewBox="0 0 20 20" fill="white"><path d="M10 0C4.478 0 0 4.478 0 10c0 5.523 4.478 10 10 10 5.523 0 10-4.477 10-10C20 4.478 15.523 0 10 0zm6.895 10.46a1.926 1.926 0 0 1-1.93-1.924c0-.37.104-.716.284-1.01C14.178 7.012 12.17 6.5 10 6.5s-4.178.512-5.25 1.026a1.908 1.908 0 0 1 .286 1.01 1.926 1.926 0 0 1-3.85 0C1.186 7.73 1.75 7.06 2.5 6.73a10.073 10.073 0 0 1 2.614-1.028L4.9 4.5a.75.75 0 0 1 .6-1.2l2.4.6C8.36 3.7 9.16 3.5 10 3.5c.84 0 1.64.2 2.1.4l2.4-.6a.75.75 0 0 1 .6 1.2l-.214 1.2a10.11 10.11 0 0 1 2.614 1.03c.75.33 1.316 1 1.316 1.806a1.924 1.924 0 0 1-1.921 1.924zM7 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-3 3.5c-1.5 0-2.75-.75-3.25-1.75h6.5C12.75 13.75 11.5 14.5 10 14.5z"/></svg>
            </div>
            <span className="text-[17px] font-semibold">Reddit</span>
            <span className="text-[12px] text-[#6E6E73] bg-[#F0F0F5] px-2 py-0.5 rounded-full">optional</span>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={reddit.username}
              onChange={e => setReddit(p => ({ ...p, username: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#E0E0E5] text-[15px] outline-none focus:border-[#0071E3] transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={reddit.password}
              onChange={e => setReddit(p => ({ ...p, password: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#E0E0E5] text-[15px] outline-none focus:border-[#0071E3] transition-colors"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving || !x.username || !x.password}
          className="w-full py-3.5 rounded-xl font-semibold text-[15px] transition-all disabled:opacity-40"
          style={{ background: saved ? '#30D158' : '#0071E3', color: 'white' }}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Credentials'}
        </button>
      </div>
    </div>
  )
}
