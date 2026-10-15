/**
 * State keys a canvas save keeps from the stored state when the saved JSON leaves them out:
 * `taste` and `baseline` (set only by the MCP tools) and `parts` (the stitch parts library; an
 * older canvas UI does not send it). A save that includes the key, even as an empty list, replaces it.
 */
export const KEEP_STORED = ["taste", "parts", "baseline"] as const;
