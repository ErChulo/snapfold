import ModelViewport from './ModelViewport.jsx'
import NetCanvas from './NetCanvas.jsx'

export default function Simulation({ net, scalePercent, setScalePercent, projectName }) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-amber-900 bg-amber-950/25 p-5 text-sm leading-6 text-amber-200">
        <strong>Legacy regression demo.</strong> Nothing on this screen is reconstructed from your photographs.
        This prism exists only to preserve and test the old unfolding/PDF machinery while the real reconstruction pipeline is under development.
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Legacy Step 4</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Synthetic prism regression model</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          The {net.sides}-facet prism is generated from photo count only. It is intentionally isolated from the photo-derived reconstruction.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-300">Synthetic 3D prism</div>
          <ModelViewport sides={net.sides} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-zinc-300">Legacy flattened layout</span>
            <span className="text-xs text-zinc-500">8.5 × 11 in</span>
          </div>
          <div className="mx-auto max-w-[520px] overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 p-2">
            <NetCanvas net={net} scalePercent={scalePercent} projectName={projectName} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <label htmlFor="scale" className="text-sm font-semibold text-zinc-200">Legacy figure scale</label>
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
      </div>
    </section>
  )
}
