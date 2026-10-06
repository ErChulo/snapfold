const labels = ['Capture', 'Upload', 'Reconstruct', 'Legacy 3D', 'Legacy Flatten', 'Legacy Tabs', 'Legacy Export']

export default function Stepper({ currentStep, onStep, disabled = false, maxEnabledStep = 3 }) {
  return (
    <nav aria-label="SnapFold workflow" className="overflow-x-auto">
      <ol className="flex min-w-max gap-2">
        {labels.map((label, index) => {
          const step = index + 1
          const active = step === currentStep
          const complete = step < currentStep
          const unavailable = step > maxEnabledStep
          return (
            <li key={label}>
              <button
                type="button"
                disabled={disabled || unavailable}
                onClick={() => onStep(step)}
                title={unavailable ? 'Not part of the photo-derived pipeline yet' : undefined}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${unavailable ? 'bg-black text-zinc-700 ring-1 ring-zinc-900' : active ? 'bg-white text-black' : complete ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-950 text-zinc-500 ring-1 ring-zinc-800'}`}
              >
                <span>{step}</span><span>{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
