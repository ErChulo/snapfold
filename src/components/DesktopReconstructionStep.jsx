import DesktopModelViewport from './DesktopModelViewport.jsx'

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  )
}

export default function DesktopReconstructionStep({
  photoPaths,
  result,
  status,
  error,
  onRun,
}) {
  const running = Boolean(status?.running)

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 3 · Native reconstruction</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">COLMAP Structure-from-Motion</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          This path uses COLMAP SIFT features, exhaustive geometric matching, incremental SfM, and COLMAP's bundle adjustment.
          It does not use SnapFold's earlier browser ORB reconstruction experiment.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRun}
          disabled={running || photoPaths.length < 3}
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Reconstructing…' : result ? 'Run reconstruction again' : 'Build real 3D reconstruction'}
        </button>
        <span className="text-xs text-zinc-500">{photoPaths.length} photographs selected</span>
      </div>

      {status && (
        <div className="rounded-2xl border border-zinc-800 bg-black p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-zinc-200">{status.message}</span>
            <span className="text-sm tabular-nums text-zinc-500">{Math.round(status.percent || 0)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-zinc-200 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, status.percent || 0))}%` }}
            />
          </div>
          {status.detail && <div className="mt-3 truncate font-mono text-[11px] text-zinc-600">{status.detail}</div>}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-5 text-sm leading-6 text-red-300">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Input photographs" value={result.inputImageCount} />
            <Metric label="Sparse 3D points" value={result.pointCount.toLocaleString()} />
            <Metric label="Mesh faces" value={result.faceCount.toLocaleString()} />
            <Metric label="Engine" value={result.engineLabel} />
          </div>

          <DesktopModelViewport result={result} />

          <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5 text-sm leading-6 text-emerald-200">
            This geometry came from the selected photographs through COLMAP. The sparse point cloud is always preserved.
            {result.meshPlyBase64
              ? ' SnapFold also produced a Delaunay surface from the COLMAP sparse reconstruction.'
              : ' Sparse meshing was not usable for this dataset, so the viewer is showing COLMAP points rather than inventing a surface.'}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-5 text-zinc-500">
            Workspace: <span className="font-mono text-zinc-400">{result.workspacePath}</span>
          </div>
        </>
      )}

      {!result && !running && (
        <div className="rounded-2xl border border-zinc-800 bg-black p-5 text-sm leading-6 text-zinc-500">
          The next screen is deliberately not a prism. Reconstruction must succeed here before SnapFold builds downstream paper geometry.
        </div>
      )}
    </section>
  )
}
