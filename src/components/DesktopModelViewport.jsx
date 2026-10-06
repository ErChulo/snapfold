import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

function decodeBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function prepareGeometry(base64) {
  if (!base64) return null
  const loader = new PLYLoader()
  const geometry = loader.parse(decodeBase64(base64))
  geometry.computeBoundingBox()
  geometry.center()
  geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere?.radius || 1
  const scale = 3.8 / Math.max(radius, 1e-6)
  geometry.scale(scale, scale, scale)
  if (geometry.index) geometry.computeVertexNormals()
  return geometry
}

function RenderGeometry({ geometry, asMesh }) {
  const hasColor = Boolean(geometry?.getAttribute('color'))
  if (asMesh && geometry?.index) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors={hasColor}
          color={hasColor ? undefined : '#d4d4d8'}
          roughness={0.72}
          metalness={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
    )
  }

  return (
    <points geometry={geometry}>
      <pointsMaterial
        vertexColors={hasColor}
        color={hasColor ? undefined : '#f4f4f5'}
        size={0.026}
        sizeAttenuation
      />
    </points>
  )
}

export default function DesktopModelViewport({ result }) {
  const [mode, setMode] = useState(result.meshPlyBase64 ? 'mesh' : 'points')
  const geometry = useMemo(
    () => prepareGeometry(mode === 'mesh' && result.meshPlyBase64 ? result.meshPlyBase64 : result.pointPlyBase64),
    [mode, result.meshPlyBase64, result.pointPlyBase64],
  )

  useEffect(() => () => geometry?.dispose(), [geometry])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-300">COLMAP reconstruction viewer</div>
        <div className="flex gap-2">
          {result.meshPlyBase64 && (
            <button
              type="button"
              onClick={() => setMode('mesh')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'mesh' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}
            >
              Mesh
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('points')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'points' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}
          >
            Sparse points
          </button>
        </div>
      </div>

      <div className="h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        {geometry && (
          <Canvas camera={{ position: [5.4, 3.6, 6.5], fov: 46 }}>
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={1.1} />
            <directionalLight position={[4, 7, 5]} intensity={2.1} />
            <directionalLight position={[-4, 2, -3]} intensity={0.7} />
            <gridHelper args={[10, 20, '#27272a', '#18181b']} position={[0, -3, 0]} />
            <RenderGeometry geometry={geometry} asMesh={mode === 'mesh'} />
            <OrbitControls enableDamping />
          </Canvas>
        )}
      </div>
    </div>
  )
}
