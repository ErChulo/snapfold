export default function AdhesiveStep({ net }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 5</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Adhesive logic</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Open boundary edges receive outward trapezoids. Each tab begins with 45° tether geometry; if it intersects another face or previously accepted tab, its depth is reduced iteratively before acceptance.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Accepted tabs" value={net.tabs.length} />
        <Metric label="Outer cut segments" value={net.cutEdges.length} />
        <Metric label="Collision policy" value="shrink / reject" />
      </div>
      <div className="rounded-2xl border border-emerald-900 bg-emerald-950/30 p-5 text-sm leading-6 text-emerald-200">
        Green shaded tabs are assembly material, not model surface area. Their dashed border remains distinct from black cut edges and from red/blue crease conventions.
      </div>
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
    </div>
  )
}
