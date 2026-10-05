const bands = [
  { label: 'Low ring', angle: '15–25°', count: '8–12 photos', note: 'Walk one full 360° circle around the stationary object.' },
  { label: 'Middle ring', angle: '35–50°', count: '12–18 photos', note: 'Make this the densest 360° ring.' },
  { label: 'High ring', angle: '60–75°', count: '8–12 photos', note: 'Complete another 360° ring to cover upper surfaces.' },
]

export default function Instructions() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 1</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Capture three orbital rings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Keep the object still. Walk three complete 360° rings around it, always aiming near its center.
          Keep the same zoom and roughly the same camera distance so the object stays about the same size in every frame.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {bands.map((band, index) => (
          <article key={band.label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-semibold text-black">{index + 1}</span>
              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300">{band.angle}</span>
            </div>
            <div className="relative mx-auto my-6 h-32 w-32">
              <div className="absolute inset-5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
              <div className="absolute inset-0 rounded-full border border-dashed border-zinc-600" />
              {Array.from({ length: 8 }, (_, i) => {
                const angle = (Math.PI * 2 * i) / 8
                const x = 58 + Math.cos(angle) * 54
                const y = 58 + Math.sin(angle) * 54
                return <span key={i} className="absolute h-3 w-3 rounded-sm bg-zinc-300" style={{ left: x, top: y }} />
              })}
            </div>
            <h3 className="font-semibold text-zinc-100">{band.label}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{band.count}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{band.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-amber-900 bg-amber-950/30 p-5 text-sm text-amber-200 md:grid-cols-2 lg:grid-cols-4">
        <div><strong>Overlap:</strong> 60–80% with neighboring photos.</div>
        <div><strong>Zoom:</strong> Keep focal length fixed; do not zoom between shots.</div>
        <div><strong>Top:</strong> Add 1–4 top-down photos if the high ring does not cover it.</div>
        <div><strong>Bottom:</strong> Optional; capture the underside as a separate set if needed.</div>
      </div>

      <p className="text-xs leading-5 text-zinc-500">
        Current v0.1.x note: SnapFold validates and previews the photo set locally, but does not yet reconstruct the real surface from image pixels.
      </p>
    </section>
  )
}
