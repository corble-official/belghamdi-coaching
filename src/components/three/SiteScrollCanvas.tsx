"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MusclesFigure, glowFade } from "./MusclesFigure";

const AIM = new THREE.Vector3(0.15, 0.95, 0);

/* Project a DOM anchor rect so the figure stands in it, feet near rect bottom,
   scaled to fit fully inside the box height. */
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
  // Center vertically inside the box (not feet-at-bottom) so the whole figure stays in bounds
  const cy = rect.top + rect.height * 0.52;
  const ndcY = -(cy / vh) * 2 + 1;
  const ty = AIM.y + (ndcY * visH) / 2;
  // Scale so the ~2-unit figure fits inside ~90% of the box height
  const boxWorldH = (Math.min(rect.height, vh * 0.92) / vh) * visH;
  const scaleT = Math.min(0.95, (boxWorldH * 0.88) / 2.0);
  return { tx, ty, scaleT };
}

function Rig({ children }: { children: ReactNode }) {
  const poseRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const matsRef = useRef<THREE.Material[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const op = useRef(0);
  const { scene, camera, gl } = useThree();

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
    // Only consider hero active when a solid portion is on screen
    const heroIn =
      !!srect &&
      srect.bottom > vh * 0.2 &&
      srect.top < vh * 0.7 &&
      srect.height > 80;

    const box = document.getElementById("muscle-explorer");
    const rect = box ? box.getBoundingClientRect() : null;
    // Explorer only when the box itself is substantially visible
    const inBox =
      !!rect &&
      rect.top < vh * 0.7 &&
      rect.bottom > vh * 0.3 &&
      rect.height > 120;

    let fadeT = 0;
    let activeRect: DOMRect | null = null;
    let tx = 0;
    let ty = 0;
    let tiltX = 0;
    let scaleT = 1;

    if (heroIn && srect) {
      fadeT = 1;
      activeRect = srect;
      ({ tx, ty, scaleT } = anchorTarget(srect, camera, vw, vh));
      // Very light mouse parallax
      tx += mouse.current.x * 0.06;
      ty += mouse.current.y * 0.012;
      tiltX = THREE.MathUtils.clamp(mouse.current.y * 0.05, -0.07, 0.07);
    } else if (inBox && rect) {
      fadeT = 1;
      activeRect = rect;
      ({ tx, ty, scaleT } = anchorTarget(rect, camera, vw, vh));
      // No parallax inside explorer — stays locked
    }
    // else: fadeT stays 0 → figure disappears, no floating over other sections

    const g = poseRef.current;
    if (g) {
      g.position.set(tx, ty, 0);
      g.scale.setScalar(scaleT);
      g.visible = op.current > 0.02;
    }

    const tl = tiltRef.current;
    if (tl) tl.rotation.x = THREE.MathUtils.damp(tl.rotation.x, tiltX, 5, delta);

    // Faster fade out so it doesn't linger
    op.current = THREE.MathUtils.damp(op.current, fadeT, fadeT > 0.5 ? 8 : 12, delta);
    const fade = op.current;
    glowFade.value = fade;

    // --- Scissor clip: only draw inside the active DOM box ---
    const renderer = gl;
    if (activeRect && fade > 0.02) {
      const dpr = renderer.getPixelRatio();
      const x = Math.max(0, activeRect.left) * dpr;
      const y = (vh - Math.min(vh, activeRect.bottom)) * dpr;
      const w = Math.min(activeRect.width, vw - Math.max(0, activeRect.left)) * dpr;
      const h = Math.min(activeRect.height, vh) * dpr;

      renderer.setScissorTest(true);
      renderer.setScissor(x, y, Math.max(1, w), Math.max(1, h));
      renderer.setViewport(x, y, Math.max(1, w), Math.max(1, h));
    } else {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, vw * renderer.getPixelRatio(), vh * renderer.getPixelRatio());
    }

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
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.autoClear = true;
      }}
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
