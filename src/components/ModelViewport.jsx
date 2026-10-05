import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function PrototypeMesh({ sides }) {
  return (
    <group rotation={[0.18, 0.45, 0]}>
      <mesh>
        <cylinderGeometry args={[1.05, 0.86, 2.4, sides, 1, false]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} metalness={0.03} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[1.055, 0.865, 2.405, sides, 1, false]} />
        <meshBasicMaterial color="#0f172a" wireframe transparent opacity={0.42} />
      </mesh>
    </group>
  )
}

export default function ModelViewport({ sides }) {
  return (
    <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-200">
      <Canvas camera={{ position: [3.4, 2.6, 4.1], fov: 44 }}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[4, 6, 5]} intensity={2.4} />
        <PrototypeMesh sides={sides} />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={8} />
      </Canvas>
    </div>
  )
}
