import type { SourceAdapter } from "./types";

/**
 * Pinterest own-boards adapter. Not in v1: see spec section 3 ("Not in v1").
 * v1 reaches Pinterest only through web search results (spec section 2 rule 4).
 */
export const pinterestOwnAdapter: SourceAdapter = {
  id: "pinterest_own",
  async search() {
    throw new Error("not in v1");
  },
};
