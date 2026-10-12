/**
 * Any other site page under the window slot: no window. Without it, a client navigation to a
 * page the slot does not know would keep the last window open (the slot keeps its old state).
 */
export default function NoWindow() {
  return null;
}
