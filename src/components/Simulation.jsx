import ModelViewport from './ModelViewport.jsx'
import NetCanvas from './NetCanvas.jsx'

export default function Simulation({ net, scalePercent, setScalePercent, projectName }) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 4</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">3D simulation and 2D Letter preview</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Until dense surface reconstruction lands, this downstream stage deliberately keeps the validated {net.sides}-facet legacy proxy. The sparse reconstruction in Step 3 is real and photo-derived; this paper net is not yet derived from that sparse cloud.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-300">3D bounding mesh</div>
          <ModelViewport sides={net.sides} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-zinc-300">Flattened single-face layout</span>
            <span className="text-xs text-zinc-500">8.5 × 11 in</span>
          </div>
          <div className="mx-auto max-w-[520px] overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 p-2">
            <NetCanvas net={net} scalePercent={scalePercent} projectName={projectName} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <label htmlFor="scale" className="text-sm font-semibold text-zinc-200">Figure scale</label>
          <output className="text-sm font-semibold text-white">{scalePercent}% of maximum printable fit</output>
        </div>
        <input
          id="scale"
          type="range"
          min="10"
          max="100"
          step="1"
          value={scalePercent}
          onChange={(event) => setScalePercent(Number(event.target.value))}
          className="mt-3 w-full accent-white"
        />
        <div className="mt-2 flex justify-between text-xs text-zinc-500"><span>Minimum practical prototype scale</span><span>Maximum within 0.25-in margins</span></div>
      </div>
    </section>
  )
}
