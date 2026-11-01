"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MusclesFigure, glowFade } from "./MusclesFigure";

const AIM = new THREE.Vector3(0.15, 0.95, 0);

/* Project DOM rect → world position. Feet near bottom of the box, scaled to fit. */
function anchorTarget(
  rect: DOMRect,
  camera: THREE.Camera,
  vw: number,
  vh: number
): { tx: number; ty: number; scaleT: number } {
  const persp = camera as THREE.PerspectiveCamera;
  const dist = camera.position.distanceTo(AIM);
  const visH = 2 * Math.tan((persp.fov * Math.PI) / 360) * dist;
  const visW = visH * (vw / vh);

  const cx = rect.left + rect.width * 0.5;
  const ndcX = (cx / vw) * 2 - 1;
  const tx = AIM.x + (ndcX * visW) / 2;

  // Feet near the bottom of the rect (classic standing pose)
  const bottom = Math.min(rect.bottom, vh * 0.96);
  const ndcY = -(bottom / vh) * 2 + 1;
  const ty = AIM.y + (ndcY * visH) / 2;

  const boxWorldH = (Math.min(rect.height, vh * 0.9) / vh) * visH;
  const scaleT = Math.min(1, (boxWorldH * 0.92) / 2.05);
  return { tx, ty, scaleT };
}

function Rig({ children }: { children: ReactNode }) {
  const poseRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const matsRef = useRef<THREE.Material[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const op = useRef(0);
  const { scene, camera } = useThree();

  useEffect(() => {
    camera.lookAt(AIM);
  }, [camera]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((_, delta) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const slotEl = document.getElementById("hero-figure");
    const srect = slotEl ? slotEl.getBoundingClientRect() : null;

    // Hero is active only while the CENTER of the slot is still on screen.
    // This prevents the tall 84vh slot from keeping the figure alive over Philosophy.
    const heroCenterY = srect ? srect.top + srect.height * 0.5 : -9999;
    const heroIn =
      !!srect &&
      heroCenterY > vh * 0.12 &&
      heroCenterY < vh * 0.78;

    const box = document.getElementById("muscle-explorer");
    const rect = box ? box.getBoundingClientRect() : null;
    const boxCenterY = rect ? rect.top + rect.height * 0.5 : -9999;
    const inBox =
      !!rect &&
      boxCenterY > vh * 0.15 &&
      boxCenterY < vh * 0.85 &&
      rect.top < vh &&
      rect.bottom > 0;

    let fadeT = 0;
    let tx = 0;
    let ty = 0;
    let tiltX = 0;
    let scaleT = 1;

    if (heroIn && srect) {
      fadeT = 1;
      ({ tx, ty, scaleT } = anchorTarget(srect, camera, vw, vh));
      // Gentle mouse parallax only in hero
      tx += mouse.current.x * 0.07;
      ty += mouse.current.y * 0.015;
      tiltX = THREE.MathUtils.clamp(mouse.current.y * 0.055, -0.08, 0.08);
    } else if (inBox && rect) {
      fadeT = 1;
      ({ tx, ty, scaleT } = anchorTarget(rect, camera, vw, vh));
      // Locked — no parallax inside the explorer box
    }
    // else fadeT = 0 → figure is hidden, never floats over other sections

    const g = poseRef.current;
    if (g) {
      g.position.set(tx, ty, 0);
      g.scale.setScalar(scaleT);
      g.visible = op.current > 0.015;
    }

    const tl = tiltRef.current;
    if (tl) {
      tl.rotation.x = THREE.MathUtils.damp(tl.rotation.x, tiltX, 5, delta);
    }

    // Fast fade-out, slightly softer fade-in
    const speed = fadeT > 0.5 ? 9 : 14;
    op.current = THREE.MathUtils.damp(op.current, fadeT, speed, delta);
    const fade = op.current;
    glowFade.value = fade;

    if (matsRef.current.length === 0) {
      const found: THREE.Material[] = [];
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (!m || m.opacity === undefined) return;
        if (m.userData.baseEmissive === undefined) {
          m.userData.baseEmissive = m.emissive ? m.emissiveIntensity : 0;
        }
        m.transparent = true;
        found.push(m);
      });
      if (found.length > 0) matsRef.current = found;
    }
    for (const m of matsRef.current) {
      m.opacity = fade;
      const base = m.userData.baseEmissive as number | undefined;
      if (base && base > 0) {
        (m as THREE.MeshStandardMaterial).emissiveIntensity = base * fade;
      }
    }
  });

  return (
    <group ref={poseRef}>
      <group ref={tiltRef}>{children}</group>
    </group>
  );
}

export default function SiteScrollCanvas() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 30, position: [0, 1.05, 4.8] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      resize={{ scroll: false }}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 30 }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[2.5, 3.5, 2.5]} intensity={2.2} color="#EAE6DD" />
      <directionalLight position={[-3, 1.4, -2.5]} intensity={3} color="#E8793F" />
      <directionalLight position={[0, -1.5, 3]} intensity={0.35} color="#77746E" />
      <spotLight position={[0.5, 4.5, 1.5]} angle={0.6} penumbra={1} intensity={1.4} color="#EAE6DD" />
      <Rig>
        <MusclesFigure />
      </Rig>
    </Canvas>
  );
}
