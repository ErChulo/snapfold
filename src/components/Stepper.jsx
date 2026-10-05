const labels = ['Capture', 'Upload', 'Simulate', 'Flatten', 'Tabs', 'Export']

export default function Stepper({ currentStep, onStep }) {
  return (
    <nav aria-label="SnapFold workflow" className="overflow-x-auto">
      <ol className="flex min-w-max gap-2">
        {labels.map((label, index) => {
          const step = index + 1
          const active = step === currentStep
          const complete = step < currentStep
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onStep(step)}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${active ? 'bg-white text-black' : complete ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-950 text-zinc-500 ring-1 ring-zinc-800'}`}
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
