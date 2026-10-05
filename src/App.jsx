import { useMemo, useState } from 'react'
import Instructions from './components/Instructions.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import Simulation from './components/Simulation.jsx'
import FlatteningStep from './components/FlatteningStep.jsx'
import AdhesiveStep from './components/AdhesiveStep.jsx'
import ExportHub from './components/ExportHub.jsx'
import Stepper from './components/Stepper.jsx'
import { createPrismNet } from './utils/unfolder.js'
import { isSupportedImage, makePreviewRecord, revokePreview } from './utils/imageFiles.js'

const LAST_STEP = 6

export default function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [photos, setPhotos] = useState([])
  const [scalePercent, setScalePercent] = useState(100)
  const [busyLabel, setBusyLabel] = useState('')
  const [errors, setErrors] = useState([])
  const net = useMemo(() => createPrismNet(photos.length || 20), [photos.length])

  const addFiles = async (files) => {
    const accepted = files.filter(isSupportedImage)
    const rejected = files.filter((file) => !isSupportedImage(file))
    const nextErrors = rejected.map((file) => `${file.name}: only JPG, PNG, HEIC, and HEIF are supported.`)
    const existingIds = new Set(photos.map((photo) => photo.id))
    const records = []

    for (let i = 0; i < accepted.length; i += 1) {
      const file = accepted[i]
      setBusyLabel(`Processing ${i + 1} of ${accepted.length}: ${file.name}`)
      try {
        const record = await makePreviewRecord(file)
        if (!existingIds.has(record.id)) {
          existingIds.add(record.id)
          records.push(record)
        } else {
          revokePreview(record)
        }
      } catch (error) {
        nextErrors.push(`${file.name}: ${error instanceof Error ? error.message : 'could not be processed'}`)
      }
    }

    setPhotos((previous) => [...previous, ...records])
    setErrors(nextErrors)
    setBusyLabel('')
  }

  const removePhoto = (id) => {
    setPhotos((previous) => {
      const removed = previous.find((photo) => photo.id === id)
      revokePreview(removed)
      return previous.filter((photo) => photo.id !== id)
    })
  }

  const stepContent = {
    1: <Instructions />,
    2: (
      <UploadPanel
        projectName={projectName}
        onProjectName={setProjectName}
        photos={photos}
        onAddFiles={addFiles}
        onRemove={removePhoto}
        busyLabel={busyLabel}
        errors={errors}
      />
    ),
    3: <Simulation net={net} scalePercent={scalePercent} setScalePercent={setScalePercent} projectName={projectName} />,
    4: <FlatteningStep net={net} />,
    5: <AdhesiveStep net={net} />,
    6: <ExportHub projectName={projectName} net={net} scalePercent={scalePercent} />,
  }[currentStep]

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800 bg-black/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}brand/snapfold-mark.svg`} alt="" className="h-11 w-11 shrink-0" />
            <div>
              <div className="text-lg font-bold tracking-tight text-white">SnapFold</div>
              <div className="text-xs text-zinc-500">Static papercraft unfolding prototype · v0.1.3</div>
            </div>
          </div>
          <div className="rounded-full border border-emerald-900 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-300">Browser-only processing</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <Stepper currentStep={currentStep} onStep={setCurrentStep} />

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-1">
          <div className="rounded-[22px] bg-zinc-950 p-5 shadow-sm sm:p-7 lg:p-8">{stepContent}</div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <div className="text-xs text-zinc-500">Step {currentStep} of {LAST_STEP}</div>
          <button
            type="button"
            disabled={currentStep === LAST_STEP}
            onClick={() => setCurrentStep((step) => Math.min(LAST_STEP, step + 1))}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </main>
    </div>
  )
}
