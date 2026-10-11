/**
 * Canvas icons are the shared pixel set (components/studio/icons, Pixelarticons, MIT).
 * Sizes: 16 in buttons and menus, 12 in chips, 24 in empty states (spec section 7).
 */
import { CursorMinimal } from "pixelarticons/react/CursorMinimal.js";
import { Grid3x3 } from "pixelarticons/react/Grid3x3.js";
import { createIcon } from "@/components/studio/icons";

export {
  CheckIcon,
  ChevronDownIcon,
  ChevronEndIcon,
  CompassIcon,
  ExternalIcon,
  FitIcon,
  FrameIcon,
  HandIcon,
  HelpIcon,
  ImageOffIcon,
  MinusIcon,
  MoreIcon,
  NoteIcon,
  PanelIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  WarningIcon,
} from "@/components/studio/icons";

// Two glyphs the shared set does not have yet (one module each, never the barrel).
// Ask WP-C to move them into components/studio/icons.
export const CursorIcon = createIcon("cursor", CursorMinimal);
export const ArrangeIcon = createIcon("arrange", Grid3x3);
