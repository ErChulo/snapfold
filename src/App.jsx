import { useMemo, useState } from 'react'
import Instructions from './components/Instructions.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import DesktopUploadPanel from './components/DesktopUploadPanel.jsx'
import ReconstructionStep from './components/ReconstructionStep.jsx'
import DesktopReconstructionStep from './components/DesktopReconstructionStep.jsx'
import Simulation from './components/Simulation.jsx'
import FlatteningStep from './components/FlatteningStep.jsx'
import AdhesiveStep from './components/AdhesiveStep.jsx'
import ExportHub from './components/ExportHub.jsx'
import Stepper from './components/Stepper.jsx'
import { createPrismNet } from './utils/unfolder.js'
import { isSupportedImage, makePreviewRecord, revokePreview } from './utils/imageFiles.js'
import { DEFAULT_MATERIAL_PROFILE } from './utils/materialProfile.js'
import {
  isTauriRuntime,
  listenReconstructionProgress,
  reconstructDesktop,
} from './utils/desktop.js'

const LAST_STEP = 7
const PHOTO_DERIVED_LAST_STEP = 3

export default function App() {
  const desktopMode = isTauriRuntime()
  const [currentStep, setCurrentStep] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [photos, setPhotos] = useState([])
  const [desktopPhotoPaths, setDesktopPhotoPaths] = useState([])
  const [scalePercent, setScalePercent] = useState(100)
  const [busyLabel, setBusyLabel] = useState('')
  const [errors, setErrors] = useState([])
  const [reconstruction, setReconstruction] = useState(null)
  const [reconstructionStatus, setReconstructionStatus] = useState(null)
  const [reconstructionError, setReconstructionError] = useState('')
  const [desktopReconstruction, setDesktopReconstruction] = useState(null)
  const [desktopStatus, setDesktopStatus] = useState(null)
  const [desktopError, setDesktopError] = useState('')
  const [legacyMode, setLegacyMode] = useState(false)
  const [materialProfile] = useState(() => ({ ...DEFAULT_MATERIAL_PROFILE }))

  const inputPhotoCount = desktopMode ? desktopPhotoPaths.length : photos.length
  const net = useMemo(() => createPrismNet(inputPhotoCount || 20), [inputPhotoCount])

  const invalidateReconstruction = () => {
    setReconstruction(null)
    setReconstructionError('')
    setDesktopReconstruction(null)
    setDesktopError('')
    setDesktopStatus(null)
    setLegacyMode(false)
    if (currentStep > PHOTO_DERIVED_LAST_STEP) setCurrentStep(PHOTO_DERIVED_LAST_STEP)
  }

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

    if (records.length) invalidateReconstruction()
    setPhotos((previous) => [...previous, ...records])
    setErrors(nextErrors)
    setBusyLabel('')
  }

  const removePhoto = (id) => {
    invalidateReconstruction()
    setPhotos((previous) => {
      const removed = previous.find((photo) => photo.id === id)
      revokePreview(removed)
      return previous.filter((photo) => photo.id !== id)
    })
  }

  const updateDesktopPhotoPaths = (paths) => {
    invalidateReconstruction()
    setDesktopPhotoPaths(paths)
  }

  const runBrowserReconstruction = async () => {
    setReconstructionError('')
    setLegacyMode(false)
    setReconstructionStatus({
      stage: 'initializing',
      current: 0,
      total: 1,
      message: 'Preparing sparse reconstruction…',
    })

    try {
      const { runSparseReconstruction } = await import('./utils/reconstruction/sparseReconstruction.js')
      const result = await runSparseReconstruction(photos, {
        materialProfile,
        onProgress: setReconstructionStatus,
      })
      setReconstruction(result)
    } catch (error) {
      setReconstructionError(error instanceof Error ? error.message : 'Sparse reconstruction failed.')
    } finally {
      setReconstructionStatus(null)
    }
  }

  const runNativeReconstruction = async () => {
    setDesktopError('')
    setDesktopReconstruction(null)
    setLegacyMode(false)
    setDesktopStatus({
      running: true,
      stage: 'starting',
      percent: 0,
      message: 'Starting dense COLMAP + OpenMVS reconstruction…',
    })

    let unlisten = null
    try {
      unlisten = await listenReconstructionProgress(setDesktopStatus)
      const result = await reconstructDesktop({
        imagePaths: desktopPhotoPaths,
        projectName,
      })
      setDesktopReconstruction(result)
      setDesktopStatus({
        running: false,
        stage: 'complete',
        percent: 100,
        message: 'Dense reconstruction ready.',
      })
    } catch (error) {
      const message = typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : 'Native reconstruction failed.'
      setDesktopError(message)
      setDesktopStatus({
        running: false,
        stage: 'failed',
        percent: 0,
        message: 'Reconstruction failed.',
      })
    } finally {
      if (typeof unlisten === 'function') unlisten()
    }
  }

  const openLegacyDemo = () => {
    if (desktopMode) return
    setLegacyMode(true)
    setCurrentStep(4)
  }

  const stepContent = {
    1: <Instructions />,
    2: desktopMode ? (
      <DesktopUploadPanel
        projectName={projectName}
        onProjectName={setProjectName}
        photoPaths={desktopPhotoPaths}
        onPhotoPaths={updateDesktopPhotoPaths}
      />
    ) : (
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
    3: desktopMode ? (
      <DesktopReconstructionStep
        photoPaths={desktopPhotoPaths}
        result={desktopReconstruction}
        status={desktopStatus}
        error={desktopError}
        onRun={runNativeReconstruction}
      />
    ) : (
      <ReconstructionStep
        photos={photos}
        reconstruction={reconstruction}
        reconstructionStatus={reconstructionStatus}
        reconstructionError={reconstructionError}
        onRun={runBrowserReconstruction}
        onOpenLegacyDemo={openLegacyDemo}
      />
    ),
    4: <Simulation net={net} scalePercent={scalePercent} setScalePercent={setScalePercent} projectName={projectName} legacyMode={legacyMode} />,
    5: <FlatteningStep net={net} />,
    6: <AdhesiveStep net={net} />,
    7: <ExportHub projectName={projectName} net={net} scalePercent={scalePercent} />,
  }[currentStep]

  const busy = desktopMode ? Boolean(desktopStatus?.running) : Boolean(reconstructionStatus)
  const maxEnabledStep = legacyMode && !desktopMode ? LAST_STEP : PHOTO_DERIVED_LAST_STEP
  const canContinue = currentStep < maxEnabledStep && !busy

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800 bg-black/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}brand/snapfold-mark.svg`} alt="" className="h-11 w-11 shrink-0" />
            <div>
              <div className="text-lg font-bold tracking-tight text-white">SnapFold</div>
              <div className="text-xs text-zinc-500">
                {desktopMode ? 'Dense COLMAP + OpenMVS reconstruction' : 'Web reconstruction diagnostic'} · v0.3.0-alpha.4
              </div>
            </div>
          </div>
          <div className="rounded-full border border-emerald-900 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            {desktopMode ? 'Local desktop · COLMAP + OpenMVS' : legacyMode ? 'Legacy prism demo active' : 'Browser-only'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <Stepper
          currentStep={currentStep}
          onStep={setCurrentStep}
          disabled={busy}
          maxEnabledStep={maxEnabledStep}
          desktopMode={desktopMode}
        />

        {legacyMode && !desktopMode && currentStep >= 4 && (
          <div className="mt-5 rounded-2xl border border-amber-900 bg-amber-950/25 p-4 text-sm leading-6 text-amber-200">
            Legacy regression mode: Steps 4–7 use the original synthetic prism and are not derived from your photographs.
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-1">
          <div className="rounded-[22px] bg-zinc-950 p-5 shadow-sm sm:p-7 lg:p-8">{stepContent}</div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={currentStep === 1 || busy}
            onClick={() => {
              if (currentStep === 4 && legacyMode) {
                setLegacyMode(false)
                setCurrentStep(3)
                return
              }
              setCurrentStep((step) => Math.max(1, step - 1))
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <div className="text-xs text-zinc-500">
            {desktopMode
              ? `Native workflow · Step ${currentStep} of 3`
              : legacyMode
                ? `Legacy demo · Step ${currentStep} of ${LAST_STEP}`
                : `Photo-derived workflow · Step ${currentStep} of ${PHOTO_DERIVED_LAST_STEP}`}
          </div>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setCurrentStep((step) => Math.min(maxEnabledStep, step + 1))}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {currentStep === PHOTO_DERIVED_LAST_STEP && !legacyMode ? 'Reconstruction is the current endpoint' : 'Continue'}
          </button>
        </div>
      </main>
    </div>
  )
}
