import type { RegisterTool } from "./types";
import { register as ping } from "./ping";

/** Every MCP tool, registered in this order by app/api/[transport]/handler.ts. */
export const tools: RegisterTool[] = [ping];
