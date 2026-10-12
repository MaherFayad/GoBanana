/**
 * Whether this browser draws with a real GPU. Without one (GPU blocklisted, turned off, or a
 * remote desktop) Chrome composites the page in software: every live backdrop blur and the WebGL
 * stage are then drawn on the CPU, on every frame the page scrolls (measured on the landing
 * page: 84% of frames dropped, against 5% with a GPU). Asked once per tab: a WebGL context that
 * refuses to start on a software renderer (`failIfMajorPerformanceCaveat`), then released.
 */
let answer: boolean | null = null;

export function hasHardwareGpu(): boolean {
  if (answer !== null) return answer;
  try {
    const c = document.createElement("canvas");
    const opts = { failIfMajorPerformanceCaveat: true };
    const gl = (c.getContext("webgl2", opts) ?? c.getContext("webgl", opts)) as WebGLRenderingContext | null;
    answer = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    answer = false;
  }
  return answer;
}
