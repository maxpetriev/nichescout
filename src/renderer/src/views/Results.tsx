import type { ResearchResult } from '../../../../lib/types'

const CONFIDENCE_COLOR = { low: '#FF9500', medium: '#0071E3', high: '#30D158' }
const CONFIDENCE_BG    = { low: '#FFF6E8', medium: '#EEF5FF', high: '#EDFBF1' }

export default function Results({ result: r, onBack }: { result: ResearchResult; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Titlebar */}
      <div className="titlebar flex items-end justify-between px-6 pb-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-[#0071E3] font-medium">
          <svg width="8" height="12" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 1L1 7l6 6"/></svg>
          New Research
        </button>
        <span className="text-[13px] text-[#6E6E73]">Research complete</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4 animate-in">
        {/* Hypothesis — hero card */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E8ED] shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-widest">Hypothesis</h2>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ color: CONFIDENCE_COLOR[r.hypothesis.confidence], background: CONFIDENCE_BG[r.hypothesis.confidence] }}>
              {r.hypothesis.confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>
          <p className="text-[22px] font-semibold text-[#1D1D1F] leading-snug mb-3">{r.hypothesis.title}</p>
          <p className="text-[14px] text-[#6E6E73] leading-relaxed">{r.hypothesis.description}</p>
        </div>

        {/* ICP + GTM — two columns */}
        <div className="grid grid-cols-2 gap-4">
          {/* ICP */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E8ED]">
            <h3 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-widest mb-4">ICP Profile</h3>
            <p className="text-[14px] font-semibold text-[#1D1D1F] mb-4">{r.icp.who}</p>

            <Section label="Pain Points">
              {r.icp.painPoints.map((p, i) => (
                <li key={i} className="text-[13px] text-[#1D1D1F]">{p}</li>
              ))}
            </Section>

            <Section label="They hang out at">
              <div className="flex flex-wrap gap-1.5">
                {r.icp.channels.map((c, i) => (
                  <span key={i} className="text-[12px] bg-[#F0F0F5] text-[#1D1D1F] px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </Section>

            <Section label="Budget">
              <p className="text-[13px] text-[#1D1D1F]">{r.icp.budget}</p>
            </Section>

            <Section label="Their words">
              <div className="flex flex-wrap gap-1.5">
                {r.icp.vocabulary.map((v, i) => (
                  <span key={i} className="text-[12px] bg-[#EEF5FF] text-[#0071E3] px-2 py-0.5 rounded-full">"{v}"</span>
                ))}
              </div>
            </Section>
          </div>

          {/* GTM */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E8ED]">
            <h3 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-widest mb-4">GTM Strategy</h3>

            <GTMRow label="Positioning" value={r.gtm.positioning} accent />
            <GTMRow label="Top Channel" value={r.gtm.topChannel} />
            <GTMRow label="Launch Move" value={r.gtm.launchMove} />
            <GTMRow label="Validate in 2 weeks" value={r.gtm.validation} />
            <GTMRow label="Timeline" value={r.gtm.timeline} />
          </div>
        </div>

        {/* Trends */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E8ED]">
          <h3 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-widest mb-4">Supporting Trends</h3>
          <div className="flex flex-wrap gap-2">
            {r.trends.map((t, i) => (
              <span key={i} className="text-[13px] bg-[#F5F5F7] border border-[#E8E8ED] text-[#1D1D1F] px-3 py-1.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>

        {/* Evidence */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E8ED]">
          <h3 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-widest mb-4">
            Evidence · {r.evidence.length} posts
          </h3>
          <div className="space-y-3">
            {r.evidence.map((e, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-[#F8F8FA] border border-[#EFEFEF]">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md self-start mt-0.5 ${
                  e.platform === 'x' ? 'bg-[#1D1D1F] text-white' : 'bg-[#FF4500] text-white'
                }`}>
                  {e.platform === 'x' ? 'X' : 'R'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#1D1D1F] mb-0.5">@{e.handle}</p>
                  <p className="text-[13px] text-[#1D1D1F] leading-relaxed mb-1.5">"{e.text}"</p>
                  <p className="text-[12px] text-[#6E6E73]">{e.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] text-[#6E6E73] font-medium mb-1.5">{label}</p>
      <ul className="space-y-1 list-none p-0 m-0">{children}</ul>
    </div>
  )
}

function GTMRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] text-[#6E6E73] font-medium mb-1">{label}</p>
      <p className={`text-[13px] leading-relaxed ${accent ? 'font-semibold text-[#1D1D1F]' : 'text-[#1D1D1F]'}`}>{value}</p>
    </div>
  )
}
