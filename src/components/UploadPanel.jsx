import { useRef, useState } from 'react'

export default function UploadPanel({ projectName, onProjectName, photos, onAddFiles, onRemove, busyLabel, errors }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const receive = (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length) onAddFiles(files)
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Step 2</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Project and photo ingestion</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Files are processed locally in this browser. SnapFold does not upload them to a server.</p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-zinc-200">Project Name</span>
        <input
          value={projectName}
          onChange={(event) => onProjectName(event.target.value)}
          placeholder="e.g. Ceramic owl prototype"
          className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-zinc-100 outline-none ring-zinc-500 transition placeholder:text-zinc-600 focus:ring-2"
        />
      </label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true) }}
        onDragOver={(event) => { event.preventDefault(); setDragActive(true) }}
        onDragLeave={(event) => { event.preventDefault(); setDragActive(false) }}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          receive(event.dataTransfer.files)
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${dragActive ? 'border-zinc-300 bg-zinc-900' : 'border-zinc-700 bg-black hover:border-zinc-500'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
          className="hidden"
          onChange={(event) => {
            receive(event.target.files)
            event.target.value = ''
          }}
        />
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-xl text-black">＋</div>
        <p className="mt-4 font-semibold text-zinc-100">Drop JPG, PNG, or HEIC photos here</p>
        <p className="mt-1 text-sm text-zinc-500">Recommended: 20–50 photographs. Click to browse instead.</p>
        {busyLabel && <p className="mt-4 text-sm font-medium text-zinc-300">{busyLabel}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${photos.length >= 20 && photos.length <= 50 ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-900 text-zinc-300'}`}>
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </span>
        {photos.length > 0 && photos.length < 20 && <span className="text-amber-300">Prototype works now; 20+ photos are recommended for a real capture set.</span>}
        {photos.length > 50 && <span className="text-amber-300">More than 50 is allowed, but the prototype caps mesh complexity.</span>}
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <img src={photo.previewUrl} alt={photo.name} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                className="absolute right-1 top-1 rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-80 transition hover:opacity-100"
                aria-label={`Remove ${photo.name}`}
              >
                ×
              </button>
              <div className="truncate px-2 py-1.5 text-[10px] text-zinc-400" title={photo.name}>{photo.name}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
