"use client";

/**
 * Marks the page `data-gpu="software"` (on html) when the browser has no real GPU (gpu.ts), so
 * desktop.css drops the live backdrop blurs that are then drawn on the CPU on every scrolled
 * frame. The glass keeps its fill, so the page reads the same, only without the blur. Asks when
 * the page is idle, so the first paint never waits on a GPU context. Renders nothing.
 */
import { useEffect } from "react";
import { hasHardwareGpu } from "./gpu";

export function GpuProbe() {
  useEffect(() => {
    const probe = () => {
      if (!hasHardwareGpu()) document.documentElement.setAttribute("data-gpu", "software");
    };
    if (!window.requestIdleCallback) {
      const t = window.setTimeout(probe, 300);
      return () => window.clearTimeout(t);
    }
    const idle = window.requestIdleCallback(probe, { timeout: 1500 });
    return () => window.cancelIdleCallback(idle);
  }, []);
  return null;
}
