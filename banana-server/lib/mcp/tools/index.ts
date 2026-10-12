import type { RegisterTool } from "./types";
import { register as ping } from "./ping";
import { register as bendBrief } from "./bend_brief";
import { register as searchReferences } from "./search_references";
import { register as rateReferences } from "./rate_references";
import { register as rateDirections } from "./rate_directions";
import { register as openCanvas } from "./open_canvas";
import { register as newCanvas } from "./new_canvas";
import { register as addToCanvas } from "./add_to_canvas";
import { register as arrangeCanvas } from "./arrange_canvas";
import { register as getCanvas } from "./get_canvas";
import { register as cutParts } from "./cut_parts";
import { register as stitchPage } from "./stitch_page";
import { register as remixStitch } from "./remix_stitch";
import { register as updateStitch } from "./update_stitch";
import { register as extractPalette } from "./extract_palette";
import { register as exportKit } from "./export_kit";
import { register as deleteCanvas } from "./delete_canvas";
import { register as saveCanvasState } from "./save_canvas_state";
import { register as loadCanvasState } from "./load_canvas_state";

/** Every MCP tool, registered in this order by app/api/[transport]/handler.ts. */
export const tools: RegisterTool[] = [
  ping,
  bendBrief,
  searchReferences,
  rateReferences,
  rateDirections,
  newCanvas,
  openCanvas,
  addToCanvas,
  arrangeCanvas,
  getCanvas,
  // Frankenstein it: cut parts out of references and stitch them into new pages.
  cutParts,
  stitchPage,
  remixStitch,
  updateStitch,
  extractPalette,
  exportKit,
  deleteCanvas,
  // App-only (MCP Apps visibility ["app"]): the inline canvas saves and reloads through them.
  saveCanvasState,
  loadCanvasState,
];
