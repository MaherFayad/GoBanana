import type { SourceAdapter } from "./types";

/**
 * Are.na adapter. Not in v1: see spec section 3 ("Not in v1"). First v2 feature by default (section 17).
 */
export const arenaAdapter: SourceAdapter = {
  id: "arena",
  async search() {
    throw new Error("not in v1");
  },
};
