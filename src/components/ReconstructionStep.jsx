import SparseViewport from './SparseViewport.jsx'

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      {hint && <div className="mt-2 text-xs leading-5 text-zinc-600">{hint}</div>}
    </div>
  )
}

export default function ReconstructionStep({
  photos,
  reconstruction,
  reconstructionStatus,
  reconstructionError,
  onRun,
}) {
  const running = Boolean(reconstructionStatus)
  const progress = reconstructionStatus?.total
    ? Math.round(100 * reconstructionStatus.current / reconstructionStatus.total)
    : 0

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 3</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Sparse 3D reconstruction</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          SnapFold discovers the overlap graph between views first, then registers the strongest connected camera network.
          For photo sets up to 24 images, every image pair is tested; upload order does not determine the reconstruction.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={running || photos.length < 2}
          onClick={onRun}
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Reconstructing…' : reconstruction ? 'Run reconstruction again' : 'Run sparse reconstruction'}
        </button>
        <span className="text-xs text-zinc-500">
          {photos.length < 2 ? 'Add at least two overlapping photographs.' : `${photos.length} photographs available.`}
        </span>
      </div>

      {reconstructionStatus && (
        <div className="rounded-2xl border border-zinc-800 bg-black p-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-zinc-200">{reconstructionStatus.message}</span>
            <span className="tabular-nums text-zinc-500">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div className="h-full rounded-full bg-zinc-200 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {reconstructionError && (
        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-5 text-sm leading-6 text-red-300">
          {reconstructionError}
        </div>
      )}

      {reconstruction && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Metric label="Photos" value={reconstruction.photosAnalyzed} />
            <Metric label="ORB features" value={reconstruction.totalFeatures.toLocaleString()} />
            <Metric label="Pairs tested" value={reconstruction.overlapPairsTested?.toLocaleString() ?? '—'} />
            <Metric label="Verified edges" value={reconstruction.acceptedPairEdges?.toLocaleString() ?? '—'} />
            <Metric label="Main component" value={`${reconstruction.mainComponentSize ?? reconstruction.registeredCameras}/${reconstruction.photosAnalyzed}`} />
            <Metric label="Registered cameras" value={`${reconstruction.registeredCameras}/${reconstruction.photosAnalyzed}`} />
            <Metric label="Sparse points" value={reconstruction.pointCount.toLocaleString()} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-zinc-300">Photo-derived sparse scene</span>
              <span className="text-xs text-zinc-600">white = points · gray = cameras / viewing direction</span>
            </div>
            <SparseViewport result={reconstruction} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-black p-5 text-sm leading-6 text-zinc-400">
              <strong className="text-zinc-200">Verified overlap graph:</strong>{' '}
              {reconstruction.acceptedPairEdges ?? 0} geometric edges in {reconstruction.connectedComponents ?? 0} connected component{reconstruction.connectedComponents === 1 ? '' : 's'}.
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-black p-5 text-sm leading-6 text-zinc-400">
              <strong className="text-zinc-200">Camera intrinsics:</strong>{' '}
              {reconstruction.intrinsicSources.join(' + ')}.
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-black p-5 text-sm leading-6 text-zinc-400">
              <strong className="text-zinc-200">Scale:</strong>{' '}
              {reconstruction.scaleNote}
            </div>
          </div>

          {reconstruction.failedCameras > 0 && (
            <div className="rounded-2xl border border-amber-900 bg-amber-950/20 p-5 text-sm leading-6 text-amber-200">
              {reconstruction.failedCameras} view{reconstruction.failedCameras === 1 ? '' : 's'} remain outside the strongest verified overlap component.
              This is now a graph-connectivity diagnostic, not an assumption that the preceding uploaded image must match.
              {reconstruction.failedNames?.length > 0 && (
                <div className="mt-2 text-xs text-amber-300/80">
                  Unregistered: {reconstruction.failedNames.join(', ')}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!reconstruction && !running && (
        <div className="rounded-2xl border border-zinc-800 bg-black p-5 text-sm leading-6 text-zinc-500">
          Alpha target: establish a robust overlap graph and camera network before dense surface reconstruction.
        </div>
      )}
    </section>
  )
}
