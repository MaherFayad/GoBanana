import type { NodeTypes } from "@xyflow/react";
import { ImageNode } from "./ImageNode";
import { NoteNode } from "./NoteNode";
import { SectionNode } from "./SectionNode";
import { StitchNode } from "./StitchNode";
import { SwatchNode } from "./SwatchNode";
import { TypeSampleNode } from "./TypeSampleNode";
import { XPostNode } from "./XPostNode";

/** Defined once at module level so React Flow does not remount nodes on every render. */
export const nodeTypes = {
  image: ImageNode,
  upload: ImageNode,
  xpost: XPostNode,
  note: NoteNode,
  swatch: SwatchNode,
  typeSample: TypeSampleNode,
  section: SectionNode,
  stitch: StitchNode,
} satisfies NodeTypes;
