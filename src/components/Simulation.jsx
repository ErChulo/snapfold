import ModelViewport from './ModelViewport.jsx'
import NetCanvas from './NetCanvas.jsx'

export default function Simulation({ net, scalePercent, setScalePercent, projectName }) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Step 3</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">3D simulation and 2D Letter preview</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The prototype converts the photo count into a {net.sides}-facet prism proxy. The right side is the exact Letter-page layout model used by PDF export.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">3D bounding mesh</div>
          <ModelViewport sides={net.sides} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-slate-700">Flattened single-face layout</span>
            <span className="text-xs text-slate-500">8.5 × 11 in</span>
          </div>
          <div className="mx-auto max-w-[520px] overflow-hidden rounded-md border border-slate-300 bg-slate-200 p-2">
            <NetCanvas net={net} scalePercent={scalePercent} projectName={projectName} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <label htmlFor="scale" className="text-sm font-semibold text-slate-800">Figure scale</label>
          <output className="text-sm font-semibold text-slate-950">{scalePercent}% of maximum printable fit</output>
        </div>
        <input
          id="scale"
          type="range"
          min="10"
          max="100"
          step="1"
          value={scalePercent}
          onChange={(event) => setScalePercent(Number(event.target.value))}
          className="mt-3 w-full"
        />
        <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Minimum practical prototype scale</span><span>Maximum within 0.25-in margins</span></div>
      </div>
    </section>
  )
}
