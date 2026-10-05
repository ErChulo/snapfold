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
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${active ? 'bg-slate-950 text-white' : complete ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
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
