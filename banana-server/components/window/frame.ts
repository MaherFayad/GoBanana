/**
 * What a window's traffic lights can do when the window stands in a WindowLayer (the canvas
 * editor, account settings): close, minimize to the dock, zoom to fill the screen. Plain React,
 * no Next imports, so the canvas code (also bundled for the inline MCP view) can read it; there
 * the context is null and the lights keep their own behaviour.
 */
import { createContext, useContext } from "react";

export type WindowFrame = {
  close: () => void;
  minimize: () => void;
  toggleZoom: () => void;
  zoomed: boolean;
  /** Where close goes when there is no history to go back to (a link target for no-JS). */
  closeHref: string;
};

export const WindowFrameContext = createContext<WindowFrame | null>(null);

export function useWindowFrame(): WindowFrame | null {
  return useContext(WindowFrameContext);
}
