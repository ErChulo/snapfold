import NetCanvas from './NetCanvas.jsx'
import { exportNetPdf } from '../utils/pdfExporter.js'

export default function ExportHub({ projectName, net, scalePercent }) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Step 6</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Export Hub</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Generate a vector Letter-size PDF from the same geometry used in the preview.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="overflow-hidden rounded-md border border-slate-300 bg-slate-200 p-2">
          <NetCanvas net={net} scalePercent={scalePercent} projectName={projectName} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm">
              <dt className="text-slate-500">Paper</dt><dd className="font-semibold">US Letter, portrait</dd>
              <dt className="text-slate-500">Margins</dt><dd className="font-semibold">0.25 in</dd>
              <dt className="text-slate-500">Sides</dt><dd className="font-semibold">Single-sided</dd>
              <dt className="text-slate-500">Geometry scale</dt><dd className="font-semibold">{scalePercent}%</dd>
              <dt className="text-slate-500">Header</dt><dd className="font-semibold">{projectName.trim() || 'Untitled project'}</dd>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => exportNetPdf({ projectName, net, scalePercent })}
            className="w-full rounded-xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Export printable PDF
          </button>
          <p className="text-xs leading-5 text-slate-500">PDF generation is local. No image data is transmitted by the export process.</p>
        </div>
      </div>
    </section>
  )
}
