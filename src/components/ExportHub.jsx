import NetCanvas from './NetCanvas.jsx'
import { exportNetPdf } from '../utils/pdfExporter.js'

export default function ExportHub({ projectName, net, scalePercent }) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 6</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Export Hub</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Generate a vector Letter-size PDF from the same geometry used in the preview.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 p-2">
          <NetCanvas net={net} scalePercent={scalePercent} projectName={projectName} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm">
              <dt className="text-zinc-500">Paper</dt><dd className="font-semibold text-zinc-100">US Letter, portrait</dd>
              <dt className="text-zinc-500">Margins</dt><dd className="font-semibold text-zinc-100">0.25 in</dd>
              <dt className="text-zinc-500">Sides</dt><dd className="font-semibold text-zinc-100">Single-sided</dd>
              <dt className="text-zinc-500">Geometry scale</dt><dd className="font-semibold text-zinc-100">{scalePercent}%</dd>
              <dt className="text-zinc-500">Header</dt><dd className="font-semibold text-zinc-100">{projectName.trim() || 'Untitled project'}</dd>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => exportNetPdf({ projectName, net, scalePercent })}
            className="w-full rounded-xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Export printable PDF
          </button>
          <p className="text-xs leading-5 text-zinc-500">PDF generation is local. No image data is transmitted by the export process.</p>
        </div>
      </div>
    </section>
  )
}
