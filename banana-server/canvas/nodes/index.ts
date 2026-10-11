import type { NodeTypes } from "@xyflow/react";
import { ImageNode } from "./ImageNode";
import { NoteNode } from "./NoteNode";
import { SectionNode } from "./SectionNode";
import { SwatchNode } from "./SwatchNode";
import { TypeSampleNode } from "./TypeSampleNode";

/** Defined once at module level so React Flow does not remount nodes on every render. */
export const nodeTypes = {
  image: ImageNode,
  upload: ImageNode,
  note: NoteNode,
  swatch: SwatchNode,
  typeSample: TypeSampleNode,
  section: SectionNode,
} satisfies NodeTypes;
