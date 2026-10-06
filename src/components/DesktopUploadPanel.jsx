import { useState } from 'react'
import { chooseDesktopPhotos } from '../utils/desktop.js'

function baseName(path) {
  return path.split(/[\\/]/).pop() || path
}

export default function DesktopUploadPanel({
  projectName,
  onProjectName,
  photoPaths,
  onPhotoPaths,
}) {
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  const choose = async () => {
    setPicking(true)
    setError('')
    try {
      const selected = await chooseDesktopPhotos()
      if (!selected.length) return
      const unique = Array.from(new Set([...photoPaths, ...selected]))
      onPhotoPaths(unique)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the native photo picker.')
    } finally {
      setPicking(false)
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 2 · Desktop</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Choose the real reconstruction photographs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          The selected files stay on this computer. SnapFold passes their local copies to the bundled COLMAP engine.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-zinc-200">Project name</span>
        <input
          value={projectName}
          onChange={(event) => onProjectName(event.target.value)}
          placeholder="e.g. Vejigante mask"
          className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-zinc-100 outline-none ring-zinc-500 transition placeholder:text-zinc-600 focus:ring-2"
        />
      </label>

      <div className="rounded-2xl border border-zinc-800 bg-black p-6">
        <button
          type="button"
          onClick={choose}
          disabled={picking}
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {picking ? 'Opening photo picker…' : photoPaths.length ? 'Add more photographs' : 'Choose photographs'}
        </button>
        <span className="ml-3 text-sm text-zinc-500">
          {photoPaths.length} selected
        </span>
        <p className="mt-3 text-xs leading-5 text-zinc-600">
          JPG, JPEG, PNG, TIFF. For this reconstruction build, use the original camera files rather than screenshots.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>
      )}

      {photoPaths.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-200">{photoPaths.length} photographs ready</span>
            <button
              type="button"
              onClick={() => onPhotoPaths([])}
              className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-200"
            >
              Clear
            </button>
          </div>
          <div className="max-h-72 overflow-auto p-2">
            {photoPaths.map((path, index) => (
              <div key={path} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-900">
                <span className="w-8 shrink-0 tabular-nums text-zinc-600">{index + 1}</span>
                <span className="truncate text-zinc-300" title={path}>{baseName(path)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
