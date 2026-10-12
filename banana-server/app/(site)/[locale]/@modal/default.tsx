/**
 * The window slot (@modal) when no window is open: nothing. Windows that open over a site page
 * (the canvas, account settings) are intercepted routes in this folder; see
 * components/window/WindowLayer.tsx.
 */
export default function NoWindow() {
  return null;
}
