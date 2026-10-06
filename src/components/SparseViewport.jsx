import { Line, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

function normalizeScene(result) {
  const points = result?.points || []
  const cameras = (result?.cameras || []).filter((camera) => camera.registered && camera.center)
  const pointSource = points.length ? points : cameras.map((camera) => camera.center)
  if (!pointSource.length) return { points: [], cameras: [] }

  const center = [0, 0, 0]
  for (const point of pointSource) {
    center[0] += point[0]
    center[1] += point[1]
    center[2] += point[2]
  }
  center[0] /= pointSource.length
  center[1] /= pointSource.length
  center[2] /= pointSource.length

  const distances = pointSource.map((point) => Math.hypot(
    point[0] - center[0],
    point[1] - center[1],
    point[2] - center[2],
  )).sort((a, b) => a - b)
  const radius = Math.max(1e-6, distances[Math.floor(distances.length * 0.9)] || distances.at(-1) || 1)
  const scale = 3.5 / radius

  const transform = (point) => [
    (point[0] - center[0]) * scale,
    (point[1] - center[1]) * scale,
    (point[2] - center[2]) * scale,
  ]

  return {
    points: points.map(transform),
    cameras: cameras.map((camera) => ({
      ...camera,
      displayCenter: transform(camera.center),
      displayForward: camera.forward,
    })),
  }
}

function PointCloud({ points }) {
  const geometry = useMemo(() => {
    const buffer = new Float32Array(points.length * 3)
    points.forEach((point, index) => {
      buffer[index * 3] = point[0]
      buffer[index * 3 + 1] = point[1]
      buffer[index * 3 + 2] = point[2]
    })
    const value = new THREE.BufferGeometry()
    value.setAttribute('position', new THREE.BufferAttribute(buffer, 3))
    return value
  }, [points])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#f4f4f5" size={0.045} sizeAttenuation />
    </points>
  )
}

function CameraMarker({ camera }) {
  const start = camera.displayCenter
  const length = 0.45
  const end = [
    start[0] + camera.displayForward[0] * length,
    start[1] + camera.displayForward[1] * length,
    start[2] + camera.displayForward[2] * length,
  ]

  return (
    <group>
      <mesh position={start}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#a1a1aa" />
      </mesh>
      <Line points={[start, end]} color="#71717a" lineWidth={1} />
    </group>
  )
}

export default function SparseViewport({ result }) {
  const scene = useMemo(() => normalizeScene(result), [result])

  return (
    <div className="h-[440px] overflow-hidden rounded-2xl border border-zinc-800 bg-black">
      <Canvas camera={{ position: [5.4, 3.8, 6.2], fov: 48 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 7, 5]} intensity={2} />
        <gridHelper args={[10, 20, '#27272a', '#18181b']} position={[0, -2.8, 0]} />
        <PointCloud points={scene.points} />
        {scene.cameras.map((camera) => <CameraMarker key={camera.index} camera={camera} />)}
        <OrbitControls enableDamping />
      </Canvas>
    </div>
  )
}
