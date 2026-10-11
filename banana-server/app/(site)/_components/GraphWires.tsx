"use client";

/**
 * Dashed curved connectors between the nodes of the "Bend it as a graph" section. Measures the
 * real node boxes (so text can wrap at any width and in either direction) and joins each node to
 * the next: side to side when they sit next to each other, top to bottom when they stack.
 * Decorative (aria-hidden): the nodes are an ordered list, so the order is already in the markup.
 * Without JS the nodes still show; only the wires are missing.
 */
import { useEffect, useRef, useState } from "react";

type Wire = { d: string; a: [number, number]; b: [number, number] };

function wiresFor(root: HTMLElement): { w: number; h: number; wires: Wire[] } {
  const box = root.getBoundingClientRect();
  const nodes = [...root.querySelectorAll<HTMLElement>("[data-node]")].map((n) => n.getBoundingClientRect());
  const rtl = getComputedStyle(root).direction === "rtl";
  const wires: Wire[] = [];
  for (let i = 0; i + 1 < nodes.length; i++) {
    const p = nodes[i]!;
    const q = nodes[i + 1]!;
    const stacked = q.top >= p.bottom - 1 && Math.abs(q.left - p.left) < p.width / 2;
    let a: [number, number];
    let b: [number, number];
    let d: string;
    if (stacked) {
      a = [p.left + p.width / 2 - box.left, p.bottom - box.top];
      b = [q.left + q.width / 2 - box.left, q.top - box.top];
      const k = (b[1] - a[1]) / 2;
      d = `M${a[0]} ${a[1]} C${a[0]} ${a[1] + k} ${b[0]} ${b[1] - k} ${b[0]} ${b[1]}`;
    } else {
      // Leave from the end edge of one node and arrive at the start edge of the next.
      a = [(rtl ? p.left : p.right) - box.left, p.top + Math.min(48, p.height / 2) - box.top];
      b = [(rtl ? q.right : q.left) - box.left, q.top + Math.min(48, q.height / 2) - box.top];
      const k = Math.max(40, Math.abs(b[0] - a[0]) / 2) * (rtl ? -1 : 1);
      d = `M${a[0]} ${a[1]} C${a[0] + k} ${a[1]} ${b[0] - k} ${b[1]} ${b[0]} ${b[1]}`;
    }
    wires.push({ d, a, b });
  }
  return { w: box.width, h: box.height, wires };
}

export function GraphWires({ targetId }: { targetId: string }) {
  const [state, setState] = useState<ReturnType<typeof wiresFor> | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const measure = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setState(wiresFor(root)));
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(root);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [targetId]);

  if (!state) return null;
  return (
    <svg className="graph-wires" width={state.w} height={state.h} viewBox={`0 0 ${state.w} ${state.h}`} aria-hidden="true" focusable="false">
      {state.wires.map((w, i) => (
        <g key={i}>
          <path className="graph-wire" d={w.d} />
          <circle className="graph-port" cx={w.a[0]} cy={w.a[1]} r="5" />
          <circle className="graph-port" cx={w.b[0]} cy={w.b[1]} r="5" />
        </g>
      ))}
    </svg>
  );
}
