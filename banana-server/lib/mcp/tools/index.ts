import type { RegisterTool } from "./types";
import { register as ping } from "./ping";
import { register as bendBrief } from "./bend_brief";
import { register as searchReferences } from "./search_references";
import { register as openCanvas } from "./open_canvas";
import { register as addToCanvas } from "./add_to_canvas";
import { register as arrangeCanvas } from "./arrange_canvas";
import { register as getCanvas } from "./get_canvas";
import { register as extractPalette } from "./extract_palette";
import { register as exportKit } from "./export_kit";
import { register as saveCanvasState } from "./save_canvas_state";

/** Every MCP tool, registered in this order by app/api/[transport]/handler.ts. */
export const tools: RegisterTool[] = [
  ping,
  bendBrief,
  searchReferences,
  openCanvas,
  addToCanvas,
  arrangeCanvas,
  getCanvas,
  extractPalette,
  exportKit,
  // App-only (MCP Apps visibility ["app"]): the inline canvas saves through it.
  saveCanvasState,
];
