"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { HeroFallback } from "./Hero3D";
import { MUSCLE_GROUPS } from "./AnatomyFigure";
import { PROGRAM_FOCUS } from "@/lib/anatomy-programs";
import { MUSCLE_PALETTE } from "@/lib/muscle-palette";
import { useMuscleExplorer } from "@/lib/muscle-store";

const ExplorerCanvas = dynamic(
  () => import("./ExplorerCanvas").then((m) => m.ExplorerCanvas),
  { ssr: false, loading: () => null }
);

function useWebglSupported() {
  const [supported, setSupported] = useState<boolean | null>(null);

  if (supported !== null) return supported;

  let inferred = true;
  if (typeof window !== "undefined") {
    try {
      const c = document.createElement("canvas");
      inferred = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      inferred = false;
    }
  }
  setSupported(inferred);
  return inferred;
}

export function AnatomyExplorer() {
  const supported = useWebglSupported();
  const active = useMuscleExplorer((s) => s.active);
  const hover = useMuscleExplorer((s) => s.hover);
  const setActive = useMuscleExplorer((s) => s.setActive);
  const setHover = useMuscleExplorer((s) => s.setHover);

  const focus = active ?? hover;
  const activeEntry = focus ? MUSCLE_GROUPS.find((g) => g.id === focus) : null;
  const programs = focus ? (PROGRAM_FOCUS[focus] ?? []) : [];

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-10 items-stretch">
      <div
        id="muscle-explorer"
        className="relative h-[560px] rounded-sm border border-wgray-dim/40 bg-obsidian overflow-hidden"
      >
        {supported ? <ExplorerCanvas /> : <HeroFallback />}
        <p className="absolute bottom-4 left-4 text-xs text-wgray font-display uppercase tracking-widest pointer-events-none z-10">
          Pick a muscle group — the figure turns to face it and lights up
        </p>
      </div>

      <div className="flex flex-col justify-center">
        <p className="eyebrow mb-3">Interactive Training Anatomy</p>
        <h3 className="heading-lg text-3xl mb-6">Explore the muscle map.</h3>
        <div className="space-y-2">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g.id}
              onMouseEnter={() => setHover(g.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(g.id)}
              onBlur={() => setHover(null)}
              onClick={() => setActive(active === g.id ? null : g.id)}
              className={`w-full text-left px-5 py-3.5 border transition-colors duration-200 ${
                focus === g.id
                  ? "border-copper bg-copper/10"
                  : "border-wgray-dim/50 hover:border-wgray bg-obsidian"
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    background: MUSCLE_PALETTE[g.id],
                    boxShadow: `0 0 10px ${MUSCLE_PALETTE[g.id]}66`,
                  }}
                />
                <span className="font-display font-semibold text-bone">{g.label}</span>
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence>
          {activeEntry && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="mt-6 p-5 border border-copper/40 bg-copper/5"
            >
              <p className="text-sm text-wgray mb-3">{activeEntry.focus}</p>
              <p className="text-xs font-display uppercase tracking-widest text-copper mb-2">
                Recommended program
              </p>
              {programs.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-bone">
                  <Sparkles className="h-4 w-4 text-copper" /> Any full-body program
                </p>
              ) : (
                programs.map((p) => (
                  <p key={p} className="flex items-center gap-2 text-sm text-bone">
                    <Sparkles className="h-4 w-4 text-copper shrink-0" /> {p}
                  </p>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
