/**
 * Banana's pixel icon set. Only these glyphs are imported, one module per glyph, so no barrel
 * of the full Pixelarticons set ever reaches a bundle. Ask WP-C (owner of components/studio
 * after Step 0) to add a glyph here rather than importing pixelarticons elsewhere.
 *
 * Plan name -> Pixelarticons glyph:
 *   external -> external-link     check -> check            compass -> compass
 *   close -> close                more -> more-horizontal   chevron -> chevron-down/up/right/left
 *   plus -> plus                  minus -> minus            fit -> aspect-ratio
 *   panel -> layout               note -> note              frame -> frame
 *   image-off -> image (with a slash, components/studio/icons/glyphs.tsx)
 *   warning -> warning-diamond    upload -> upload          share -> share
 *   link -> link                  hand -> hand              help -> circle-question
 *   search -> search                cursor -> cursor-minimal  arrange -> grid-3x3
 *   Toast kinds: info -> circle-info, error -> square-alert, success -> check, warning -> warning-diamond.
 *   Site and dashboard: arrow -> arrow-right   docs -> book-open    feedback -> mail
 *   sign-out -> logout   account -> user   collapse -> arrow-bar-left   expand -> arrow-bar-right
 *   sparkle -> sparkle   canvases -> images   clock -> clock
 *   Landing page visuals: terminal -> terminal   copy -> copy   file -> file-text
 *   checklist -> checkbox-on   swatch -> colors-swatch   code -> braces   sticky -> sticky-note
 *   brief -> clipboard-note   shield -> shield   send -> send   plug -> plug   image -> image
 *   chat -> message (a neutral mark for ChatGPT: simple-icons dropped the OpenAI logo in v16)
 */
import { ArrowBarLeft } from "pixelarticons/react/ArrowBarLeft.js";
import { ArrowBarRight } from "pixelarticons/react/ArrowBarRight.js";
import { ArrowRight } from "pixelarticons/react/ArrowRight.js";
import { AspectRatio } from "pixelarticons/react/AspectRatio.js";
import { BookOpen } from "pixelarticons/react/BookOpen.js";
import { Check } from "pixelarticons/react/Check.js";
import { ChevronDown } from "pixelarticons/react/ChevronDown.js";
import { ChevronLeft } from "pixelarticons/react/ChevronLeft.js";
import { ChevronRight } from "pixelarticons/react/ChevronRight.js";
import { ChevronUp } from "pixelarticons/react/ChevronUp.js";
import { CircleInfo } from "pixelarticons/react/CircleInfo.js";
import { CircleQuestion } from "pixelarticons/react/CircleQuestion.js";
import { Clock } from "pixelarticons/react/Clock.js";
import { Close } from "pixelarticons/react/Close.js";
import { Compass } from "pixelarticons/react/Compass.js";
import { CursorMinimal } from "pixelarticons/react/CursorMinimal.js";
import { ExternalLink } from "pixelarticons/react/ExternalLink.js";
import { Frame } from "pixelarticons/react/Frame.js";
import { Grid3x3 } from "pixelarticons/react/Grid3x3.js";
import { Hand } from "pixelarticons/react/Hand.js";
import { Images } from "pixelarticons/react/Images.js";
import { Layout } from "pixelarticons/react/Layout.js";
import { Link } from "pixelarticons/react/Link.js";
import { Logout } from "pixelarticons/react/Logout.js";
import { Mail } from "pixelarticons/react/Mail.js";
import { Minus } from "pixelarticons/react/Minus.js";
import { MoreHorizontal } from "pixelarticons/react/MoreHorizontal.js";
import { Note } from "pixelarticons/react/Note.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { Search } from "pixelarticons/react/Search.js";
import { Share } from "pixelarticons/react/Share.js";
import { Sparkle } from "pixelarticons/react/Sparkle.js";
import { SquareAlert } from "pixelarticons/react/SquareAlert.js";
import { Upload } from "pixelarticons/react/Upload.js";
import { User } from "pixelarticons/react/User.js";
import { WarningDiamond } from "pixelarticons/react/WarningDiamond.js";
import { Braces } from "pixelarticons/react/Braces.js";
import { CheckboxOn } from "pixelarticons/react/CheckboxOn.js";
import { ClipboardNote } from "pixelarticons/react/ClipboardNote.js";
import { ColorsSwatch } from "pixelarticons/react/ColorsSwatch.js";
import { Copy } from "pixelarticons/react/Copy.js";
import { FileText } from "pixelarticons/react/FileText.js";
import { Image } from "pixelarticons/react/Image.js";
import { Message } from "pixelarticons/react/Message.js";
import { Plug } from "pixelarticons/react/Plug.js";
import { Send } from "pixelarticons/react/Send.js";
import { Shield } from "pixelarticons/react/Shield.js";
import { StickyNote } from "pixelarticons/react/StickyNote.js";
import { Terminal } from "pixelarticons/react/Terminal.js";
import { createIcon } from "./Icon";
import { ImageOffGlyph } from "./glyphs";

export { createIcon } from "./Icon";
export type { IconComponent, IconProps, IconSize } from "./Icon";

export const ExternalIcon = createIcon("external", ExternalLink);
export const CheckIcon = createIcon("check", Check);
export const CompassIcon = createIcon("compass", Compass);
export const CloseIcon = createIcon("close", Close);
export const MoreIcon = createIcon("more", MoreHorizontal);
export const ChevronDownIcon = createIcon("chevron-down", ChevronDown);
export const ChevronUpIcon = createIcon("chevron-up", ChevronUp);
/** Points toward inline end: right in English, left in Arabic. */
export const ChevronEndIcon = createIcon("chevron-end", ChevronRight, { mirror: true });
/** Points toward inline start: left in English, right in Arabic. */
export const ChevronStartIcon = createIcon("chevron-start", ChevronLeft, { mirror: true });
export const PlusIcon = createIcon("plus", Plus);
export const MinusIcon = createIcon("minus", Minus);
export const FitIcon = createIcon("fit", AspectRatio);
export const PanelIcon = createIcon("panel", Layout, { mirror: true });
export const NoteIcon = createIcon("note", Note);
export const FrameIcon = createIcon("frame", Frame);
export const ImageOffIcon = createIcon("image-off", ImageOffGlyph);
export const WarningIcon = createIcon("warning", WarningDiamond);
export const UploadIcon = createIcon("upload", Upload);
export const ShareIcon = createIcon("share", Share);
export const LinkIcon = createIcon("link", Link);
export const HandIcon = createIcon("hand", Hand);
export const HelpIcon = createIcon("help", CircleQuestion);
export const SearchIcon = createIcon("search", Search);
export const InfoIcon = createIcon("info", CircleInfo);
export const ErrorIcon = createIcon("error", SquareAlert);
/** Select tool. */
export const CursorIcon = createIcon("cursor", CursorMinimal);
/** Arrange menu. */
export const ArrangeIcon = createIcon("arrange", Grid3x3);

/** Points toward inline end: "Add to Claude" and other forward links. */
export const ArrowEndIcon = createIcon("arrow-end", ArrowRight, { mirror: true });
export const DocsIcon = createIcon("docs", BookOpen);
export const FeedbackIcon = createIcon("feedback", Mail);
export const SignOutIcon = createIcon("sign-out", Logout, { mirror: true });
export const AccountIcon = createIcon("account", User);
/** Sidebar collapse and expand: the bar sits on the inline-start side. */
export const CollapseIcon = createIcon("collapse", ArrowBarLeft, { mirror: true });
export const ExpandIcon = createIcon("expand", ArrowBarRight, { mirror: true });
export const SparkleIcon = createIcon("sparkle", Sparkle);
export const CanvasesIcon = createIcon("canvases", Images);
export const ClockIcon = createIcon("clock", Clock);

export const TerminalIcon = createIcon("terminal", Terminal);
export const CopyIcon = createIcon("copy", Copy);
export const FileIcon = createIcon("file", FileText);
export const ChecklistIcon = createIcon("checklist", CheckboxOn);
export const SwatchIcon = createIcon("swatch", ColorsSwatch);
export const CodeIcon = createIcon("code", Braces);
export const StickyIcon = createIcon("sticky", StickyNote);
export const BriefIcon = createIcon("brief", ClipboardNote);
export const ShieldIcon = createIcon("shield", Shield);
export const SendIcon = createIcon("send", Send, { mirror: true });
export const PlugIcon = createIcon("plug", Plug);
export const ImageIcon = createIcon("image", Image);
export const ChatIcon = createIcon("chat", Message);
