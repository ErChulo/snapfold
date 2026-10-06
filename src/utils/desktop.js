export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

export async function chooseDesktopPhotos() {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    multiple: true,
    directory: false,
    title: 'Choose photographs for SnapFold reconstruction',
    filters: [
      {
        name: 'Photographs',
        extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff'],
      },
    ],
  })

  if (!selected) return []
  return Array.isArray(selected) ? selected : [selected]
}

export async function reconstructDesktop({ imagePaths, projectName }) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('reconstruct_colmap', {
    imagePaths,
    projectName,
  })
}

export async function listenReconstructionProgress(callback) {
  const { listen } = await import('@tauri-apps/api/event')
  return listen('snapfold://reconstruction-progress', (event) => callback(event.payload))
}
