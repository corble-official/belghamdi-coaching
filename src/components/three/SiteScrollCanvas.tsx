"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MusclesFigure, glowFade } from "./MusclesFigure";

const AIM = new THREE.Vector3(0.15, 0.95, 0);

/* Project a DOM anchor rect so the figure stands in it, feet near rect bottom,
   scaled to its height. Hard-glued: no scroll drift — stays locked to its slot. */
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
  const bottom = Math.min(rect.bottom, vh * 0.94);
  const ndcY = -(bottom / vh) * 2 + 1;
  const ty = AIM.y + (ndcY * visH) / 2;
  const boxWorldH = (Math.min(rect.height, vh * 0.9) / vh) * visH;
  const scaleT = Math.min(1, boxWorldH / 2.0);
  return { tx, ty, scaleT };
}

function Rig({ children }: { children: ReactNode }) {
  const poseRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const matsRef = useRef<THREE.Material[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const op = useRef(0);
  const lastTarget = useRef<"hero" | "explorer" | null>(null);
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

    // The figure belongs to #hero-figure or #muscle-explorer.
    // No scroll drift — position is hard-set every frame so it stays locked.
    const slotEl = document.getElementById("hero-figure");
    const srect = slotEl ? slotEl.getBoundingClientRect() : null;
    const heroIn =
      !!srect && srect.bottom > vh * 0.25 && srect.top < vh * 0.65;
    const box = document.getElementById("muscle-explorer");
    const rect = box ? box.getBoundingClientRect() : null;
    const inBox =
      !!rect && rect.top < vh * 0.75 && rect.bottom > vh * 0.25;

    let fadeT = 0;
    let name: "hero" | "explorer" | null = null;
    let tx = 0;
    let ty = 0;
    let tiltX = 0;
    let scaleT = 1;

    if (heroIn && srect) {
      name = "hero";
      fadeT = 1;
      ({ tx, ty, scaleT } = anchorTarget(srect, camera, vw, vh));
      // Light mouse parallax only (no scroll offset)
      tx += mouse.current.x * 0.08;
      ty += mouse.current.y * 0.015;
      tiltX = THREE.MathUtils.clamp(mouse.current.y * 0.06, -0.08, 0.08);
    } else if (inBox && rect) {
      name = "explorer";
      fadeT = 1;
      // Hard lock inside the explorer box — no drift, no extra offsets
      ({ tx, ty, scaleT } = anchorTarget(rect, camera, vw, vh));
    } else if (lastTarget.current) {
      // Fade-out: keep following the last zone so the figure leaves with its section
      const prev = lastTarget.current;
      const prevEl =
        prev === "hero" ? slotEl : document.getElementById("muscle-explorer");
      const prevRect = prevEl ? prevEl.getBoundingClientRect() : null;
      if (prevRect) {
        ({ tx, ty, scaleT } = anchorTarget(prevRect, camera, vw, vh));
      }
    }

    const g = poseRef.current;
    if (g) {
      // Hard-glue every frame — no damping on position
      g.position.set(tx, ty, 0);
      g.scale.setScalar(scaleT);
      g.visible = op.current > 0.01;
    }
    lastTarget.current = name;

    const tl = tiltRef.current;
    if (tl) tl.rotation.x = THREE.MathUtils.damp(tl.rotation.x, tiltX, 4, delta);

    op.current = THREE.MathUtils.damp(op.current, fadeT, 7, delta);
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
