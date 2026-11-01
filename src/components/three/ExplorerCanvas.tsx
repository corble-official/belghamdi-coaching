"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { MusclesFigure, glowFade } from "./MusclesFigure";

function KeepGlowOn() {
  useFrame(() => {
    // Explorer has its own canvas — never inherit the hero's fade-out
    glowFade.value = 1;
  });
  return null;
}

/**
 * Self-contained 3D canvas that lives INSIDE #muscle-explorer.
 * The parent has overflow-hidden, so the figure is naturally clipped
 * and never depends on page scroll for positioning.
 */
export function ExplorerCanvas() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 28, position: [0, 0.95, 4.2] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 3.5, 2.5]} intensity={2.2} color="#EAE6DD" />
      <directionalLight position={[-3, 1.4, -2.5]} intensity={2.8} color="#E8793F" />
      <directionalLight position={[0, -1.5, 3]} intensity={0.35} color="#77746E" />
      <spotLight position={[0.5, 4.5, 1.5]} angle={0.6} penumbra={1} intensity={1.3} color="#EAE6DD" />

      <KeepGlowOn />

      {/* Centered and scaled to fit the 560px box */}
      <group position={[0, -0.95, 0]} scale={0.92}>
        <MusclesFigure />
      </group>
    </Canvas>
  );
}
