export default function AdhesiveStep({ net }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Step 5</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Adhesive logic</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Open boundary edges receive outward trapezoids. Each tab begins with 45° tether geometry; if it intersects another face or previously accepted tab, its depth is reduced iteratively before acceptance.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Accepted tabs" value={net.tabs.length} />
        <Metric label="Outer cut segments" value={net.cutEdges.length} />
        <Metric label="Collision policy" value="shrink / reject" />
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
        Green shaded tabs are assembly material, not model surface area. Their dashed border remains distinct from black cut edges and from red/blue crease conventions.
      </div>
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  )
}
