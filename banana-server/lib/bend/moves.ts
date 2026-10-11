import type { ListName } from "./lists";
import type { Ingredients, MoveId } from "./types";

export interface MoveDef {
  id: MoveId;
  /** Word list the move draws from. The lens move uses the lens preset terms when one is set. */
  list: ListName;
  /** Ingredient slot the picked entry fills. */
  slot: Exclude<keyof Ingredients, "mood">;
  /** Word placed before the entry in queries ("oversized numerals"). */
  prefix: string;
  /** Query tail when this is the primary move (spec section 7 query patterns). */
  fullTail: string;
  /** Query tail when this move is combined with others. */
  shortTail: string;
}

/**
 * Query patterns (spec section 7):
 * transplant  {object} packaging design {mood}
 * material    {material} texture ui design
 * era         {era} graphic design {subject}
 * constraint  {constraint} web design
 * scale       oversized {element} poster
 * lens        {tradition} pattern contemporary design
 */
export const MOVE_DEFS: Record<MoveId, MoveDef> = {
  transplant: { id: "transplant", list: "objects", slot: "object", prefix: "", fullTail: "packaging design", shortTail: "packaging" },
  material: { id: "material", list: "materials", slot: "material", prefix: "", fullTail: "texture ui design", shortTail: "texture" },
  era: { id: "era", list: "eras", slot: "era", prefix: "", fullTail: "graphic design", shortTail: "" },
  constraint: { id: "constraint", list: "constraints", slot: "constraint", prefix: "", fullTail: "web design", shortTail: "" },
  scale: { id: "scale", list: "elements", slot: "element", prefix: "oversized", fullTail: "poster", shortTail: "" },
  lens: { id: "lens", list: "traditions", slot: "tradition", prefix: "", fullTail: "pattern contemporary design", shortTail: "pattern" },
};
