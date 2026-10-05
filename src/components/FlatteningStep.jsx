export default function FlatteningStep({ net }) {
  const metrics = [
    ['Input photographs', net.photoCount],
    ['Proxy side facets', net.sides],
    ['Flattened faces', net.faces.length],
    ['Fold edges', net.folds.length],
  ]

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 4</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Flattening engine</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          SnapFold’s static prototype builds a regular faceted prism, unwraps its side faces into a strip, attaches top and bottom cap polygons, and classifies shared edges as folds rather than cuts.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
            <div className="text-3xl font-semibold text-white">{value}</div>
            <div className="mt-1 text-sm text-zinc-500">{label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-black p-5 font-mono text-xs leading-6 text-zinc-300">
        <div>photos → facet-count clamp( round(n / 3), 6, 16 )</div>
        <div>3D prism → ordered face adjacency → planar side strip + polygon caps</div>
        <div>shared edge → fold; unshared edge → cut candidate</div>
        <div>page fit → min(usableWidth / bboxWidth, usableHeight / bboxHeight) × userScale</div>
      </div>
    </section>
  )
}
