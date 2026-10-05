const bands = [
  { label: 'Low orbit', angle: '10–25°', note: 'Capture undersides, base transitions, and low silhouette changes.' },
  { label: 'Mid orbit', angle: '35–55°', note: 'Make this the densest ring; keep 60–80% overlap between frames.' },
  { label: 'High orbit', angle: '65–80°', note: 'Capture top surfaces and features hidden from the mid-level ring.' },
]

export default function Instructions() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Step 1</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Capture an orbital photo set</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Take 20–50 overlapping photographs around the object. Keep lighting, zoom, and object position as constant as possible.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {bands.map((band, index) => (
          <article key={band.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">{index + 1}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{band.angle}</span>
            </div>
            <div className="relative mx-auto my-6 h-32 w-32">
              <div className="absolute inset-5 rounded-full border-2 border-slate-300 bg-slate-50" />
              <div className="absolute inset-0 rounded-full border border-dashed border-slate-400" />
              {Array.from({ length: 8 }, (_, i) => {
                const angle = (Math.PI * 2 * i) / 8
                const x = 58 + Math.cos(angle) * 54
                const y = 58 + Math.sin(angle) * 54
                return <span key={i} className="absolute h-3 w-3 rounded-sm bg-slate-800" style={{ left: x, top: y }} />
              })}
            </div>
            <h3 className="font-semibold text-slate-900">{band.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{band.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 md:grid-cols-3">
        <div><strong>Overlap:</strong> 60–80% between neighboring images.</div>
        <div><strong>Background:</strong> Prefer texture and avoid reflective clutter.</div>
        <div><strong>Object:</strong> Do not move it between photographs.</div>
      </div>
    </section>
  )
}
