/**
 * Open modal dialogs, newest last. A modal <dialog> (showModal) puts itself in the top layer
 * and makes the rest of the page inert, so anything rendered outside it (the toast stack and
 * its live regions) is covered by the backdrop and no longer reaches screen readers.
 * Dialog.tsx registers here; Toast.tsx renders into the newest open modal while there is one.
 */

let stack: readonly HTMLElement[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

export const modalStack = {
  push(el: HTMLElement): void {
    stack = [...stack.filter((x) => x !== el), el];
    emit();
  },
  remove(el: HTMLElement): void {
    if (!stack.includes(el)) return;
    stack = stack.filter((x) => x !== el);
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** The newest open modal, or null. */
  top(): HTMLElement | null {
    return stack.at(-1) ?? null;
  },
};
