# GoBanana build rules

Every `gb-builder` loads this whole file before it writes any code, and so does the main thread when it builds inline. It applies in **Drafts** (picked directions only) and in **Finished** mode (gobanana-finish), always after the user's pick. Adapted from the owner's Strategic UI Implementation Rules (source: `docs/build-rules.md` in the GoBanana monorepo), bent for GoBanana: the input is a picked direction, not an image to copy, and reference images are never taken.

Versions checked 2026-10-17 with `npm view`: next 16.4.2, tailwindcss 4.3.3, shadcn 4.22.0 (CLI), next-intl 4.14.9. Check again at build time with `npm view <package> version`; never pin from memory.

**For subagents:** your packet says what you own and what you must not touch. Where this file says "ask", you do not ask the user: put the question under "Questions for the main thread" in your return, take the safe default (change nothing shared, keep the base), and go on.

---

## 1. Role and goal

You are a senior front-end engineer building one picked GoBanana direction into the user's product.
- Your inputs are the direction contract, `SPEC.md`, `WIREFRAMES.md`, the Pick page sketch, and the parts on the board.
- Build from the project's own components first.
- Accuracy, accessibility, performance and clean architecture are not optional.

You are **not** copying a picture:
- **References** on the board give structure and one move to take (the `steal:` and `becomes:` notes). Never their pixels, text or images.
- **The user's own design** (their Figma file, their screenshot) is the one thing you match closely, when they give one.

## 2. Plan before you build

Before writing code, write a component map and show it in one table:

| Region (from WIREFRAMES.md) | Use | Source |
| --- | --- | --- |
| Header | `SiteHeader` | existing, `src/components/site-header.tsx` |
| Approval gate | `Card` plus new `ApprovalStrip` | shadcn `card` exists; `ApprovalStrip` new in `components/signature/` |
| Filters | `Tabs`, `Select` | `npx shadcn@latest add tabs select` |

Steps:
- **Read the hierarchy:** page, then sections, then components.
- **Find what exists:** look in `components.json` (its `aliases` say where components live), `src/components`, `components/ui`, and any design system package in the monorepo.
- **Do not reinvent.** If a component exists, use it, or add a variant to it. Create a new component only when the UI is truly new, which is usually the direction's signature move.

## 3. The component ladder

Take the first rung that fits:

1. **The project's own components.** Use them as they are, or add a variant inside the same file (with `cva` when the project uses it). Never copy a component to change it.
2. **The project already uses shadcn but lacks a primitive:** add it with the CLI, `npx shadcn@latest add <name>`, matching the project's package manager (`pnpm dlx`, `bunx`). It lands where `components.json` says, on the project's existing base.
3. **No component system at all:** set up shadcn on the base that fits the product (section 3a), with the style closest to the picked direction (section 3b).
   - Then add only the primitives `WIREFRAMES.md` names.
4. **Never add a second UI library** next to an existing one (no shadcn beside MUI, Chakra or Ant). Build missing parts in the existing library's own conventions instead, and say so in one line.

### 3a. Which library, and why shadcn stays the layer

The ask was "the most dynamic, easiest to restyle library". In October 2026 that is still shadcn, because it is no longer one library:
- **One code layer over three bases.** shadcn now installs the same components on three primitive layers. Base UI has been the default since July 2026; Radix stays supported (`-b radix`); React Aria is an option (`--base aria`).
- **The same 8 visual styles on every base:** Vega, Nova, Maia, Lyra, Mira, Luma, Rhea, Sera.
- **Restyling without a rewrite:**
  - A **preset** packs theme, colors, CSS variables, fonts and icons into one code.
  - `shadcn apply --preset <code>` switches an existing project to a new preset and keeps its base and RTL settings ([changelog, April 2026](https://ui.shadcn.com/docs/changelog/2026-04-shadcn-apply)).
- **The code is the project's own.** Signature moves are plain edits; nothing to fight in a theming API.
- **Agents know it best.** There is an official agent skill (`npx skills add shadcn/ui`) and an MCP server.

**Pick the base:**

| Product | Base | Why |
| --- | --- | --- |
| Arabic first or GCC market, bookings, dates, numbers, forms in two languages | **React Aria** (`npx shadcn@latest init --base aria`) | The deepest i18n of the three: "translations in over 30 languages, localized date and number formatting and parsing... 13 calendar systems, 5 numbering systems, right-to-left layout" ([React Aria](https://react-aria.adobe.com)). Wrap the app in its `I18nProvider` with the locale, so portals (dialogs, popovers) get the right direction. |
| Everything else, new project | **Base UI** (the default, `npx shadcn@latest init`) | shadcn's default since July 2026; smaller bundles than Radix |
| The project already runs shadcn on Radix | **Keep Radix** | Never change a project's base as a side effect of a design task |

**Other libraries considered:**

| Library | Why it is not the default here |
| --- | --- |
| HeroUI | Built on React Aria and Tailwind, but ships as a package with its own theme plugin; less code the project owns. Use it only when the project already does. |
| Mantine | Strong and has RTL support, but styles with CSS Modules, not Tailwind v4, and ships as a package |
| MUI | A mature theming API, but heavy, and restyling fights its Material defaults |
| Untitled UI React | React Aria plus Tailwind with an RTL class converter; check its licence tiers before use |
| Ark UI and Park UI | Good state-machine primitives; Park UI leans on Panda CSS, and fewer agents know it well |

**Unverified:** whether shadcn's automatic RTL class transform (`"rtl": true`) works the same on the React Aria base as on Base UI and Radix. The RTL docs say the transform "is only available for projects created using `shadcn create`". Check on the first Arabic build and record the result in `DECISIONS.md`.

### 3b. From a picked direction to a shadcn style

The direction's language axes (v4 plan, section 5) pick the closest style. Tokens then do the rest:

| Direction language | Closest style |
| --- | --- |
| Balanced density, neutral composition | Vega (the classic look) |
| Dense, list-first or data-heavy | Nova or Mira (compact) |
| Rounded type voice, airy density, soft material | Maia (soft and rounded) |
| Grid or poster composition, sharp edges, condensed or mono type | Lyra (boxy and sharp) |
| Anything else | Luma, Rhea or Sera: look at each on shadcn/create and pick by eye. Their published descriptions are not in this plan yet. |

**Rules:**
- **Drafts:** never run `shadcn apply` or `init` in an existing project. `apply` reinstalls the existing components, which can overwrite local edits. The direction lives in scoped token overrides only (section 6).
- **Finished, new project:** `init` with the chosen base and style, then write the direction's `ship` tokens into the theme.
- **Finished, existing shadcn project after Gate 2:**
  1. Run `apply` only when the project's components have no local edits. Check with `git diff` against a fresh `shadcn add` of the same component.
  2. Otherwise change tokens by hand.
  3. Ask before either one (a subagent returns this as a question for the main thread).

**shadcn components are the project's own code once added.**
- Edit them in place for project-wide fixes.
- Keep the direction's look in tokens and variants, not in hard edits to every file.
- The signature move lives in `components/signature/`, so it can be tuned or removed in one place.

## 4. Assets

- **Never download, export or copy reference images.** This includes images from the GoBanana board, Mobbin and every web reference. This is a GoBanana hard rule, and it outranks every other rule here.
- **Allowed sources:**
  - **The user's own Figma file:** export through the Figma MCP (`download_assets`) into the project's assets folder, when the user points to their file.
  - **The project's existing assets.**
  - **The project's icon set.** When there is none, Lucide, which shadcn uses by default.
  - **An image the user provides.**
- **When a needed image does not exist:** use a designed placeholder (the right aspect ratio, a tinted ground from the palette, a short label such as "Product photo") and list it in the hand-off as "to replace". Never a broken path, never an unstyled grey box, never a random stock image.

## 5. Arabic and English

**Both languages get equal care.**

**Default language:**
- Use the project's.
- When the project has none and the brief or `CONTEXT.md` names an Arabic or GCC market, the default is Arabic (`ar`) with English (`en`) fully supported.
- Otherwise use English, with RTL-safe code anyway.

**Designs:**
- When the incoming design is in Arabic, match it in Arabic first, then check English.
- When it is in English, do the reverse.

**Translation:**
- Use the project's i18n library. When there is none, use `next-intl` with the App Router.
- Never hardcode a string in JSX in either language.
- Every key lands in both `ar` and `en` files in the same change.

**Direction:**
- Set `dir` on `<html>` from the locale.
- Wrap the app in shadcn's `DirectionProvider` (`npx shadcn@latest add direction`) so Radix parts follow it.
- Use logical properties and classes only: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`. Never `ml-*`, `mr-*`, `left-*` or `right-*` for layout.
- Set `"rtl": true` in `components.json` so new components arrive with logical classes. Migrate existing ones with `npx shadcn@latest migrate rtl [path]`.
- shadcn does not auto-migrate **Calendar, Pagination and Sidebar**. Fix those by hand from their RTL sections.
- Pass `dir` to portal content (dialogs, sheets, popovers, dropdowns). The logical slide animations from `tw-animate-css` do not flip on their own ([shadcn RTL docs](https://ui.shadcn.com/docs/rtl)).

**What mirrors and what stays:**
- **Mirror:** navigation order, chevrons and back arrows (`rtl:rotate-180`), progress, sliders, steppers, timelines.
- **Do not mirror:**
  - media controls (play, forward)
  - charts with time on the x axis
  - logos
  - phone numbers, card numbers and codes
  - checkmarks

**Arabic copy rules (GoBanana):**
- Labels as nouns: الدفع, not ادفع الآن.
- No diacritics.
- Western digits (0 to 9) for prices, dates, times and counts.
- Latin codes stay Latin (RUH, SAR, SV).

**Fonts:**
- An Arabic face and a Latin face that share weight and x-height feel. The direction names them; GoBanana lenses name Arabic display faces on Google Fonts.
- `font-display: swap`.
- Line height about 1.6 for Arabic body text.

## 6. Tokens and styling (Tailwind v4)

- **Colors:**
  - Map every direction color to a theme variable (`--primary`, `--background`, `--muted`, plus the direction's own roles) in the global CSS `@theme`.
  - Use them as classes: `bg-primary`, `text-muted-foreground`. No hex in components.
  - Only colors tagged `ship` become tokens. `explore` colors never ship.
- **Scope:**
  - **Drafts:** the direction's tokens are overrides on a wrapper for the drafted pages only, for example `[data-direction="flight-strip"]`. The project's theme stays as it is.
  - **Finished:** after Gate 2 the direction becomes the system tokens, written once in the theme file.
- **Use the project's scales** for radius, shadow, spacing and type. Add a new step only when the direction needs it, and name it.
- **Contrast:** every text and background pair meets WCAG 2.2 AA (SC 1.4.3: 4.5:1 for body, 3:1 for large text). UI parts and focus rings meet 3:1 (SC 1.4.11). Check with the numbers from `extract_palette` or a contrast script, never by eye.

## 7. Code quality

- **Framework:** use the project's Next.js version and router. A new app uses the latest stable Next.js with the App Router and TypeScript strict.
- **Server components by default.** Add `"use client"` only to the parts that need state, effects or browser APIs, and keep those small. Load heavy parts (charts, editors, maps) with dynamic import.
- **Types:** exact interfaces for props, API data and state. No `any`. Pass existing components the props their types ask for, so the build does not break.
- **Structure:**
  - one responsibility per component
  - shared logic in `lib/`
  - no inline styles
  - DRY where it reads better, not as a rule to merge unlike things

## 8. Edge cases and access

Build every state `SPEC.md` lists, and always these:
- empty
- loading (skeletons that match the layout)
- error with a way out
- offline when the app can be used offline
- the longest realistic string in both languages: Arabic and English lengths differ, so test both at 2x length
- numbers at their largest ("SAR 1,250,000.00")

Access (WCAG 2.2 AA):
- Keyboard reach for every action.
- Visible focus (SC 2.4.7, 2.4.11).
- Targets at least 24 by 24 px (SC 2.5.8).
- Labels on every input.
- `prefers-reduced-motion` respected; the signature move keeps a still version.

## 9. How to finish

- **Match the structure of the picked sketch or wireframe and the direction contract, not a reference image.** When the user gave their own design, match it closely and say each difference as a number ("title 28px, design 32px").
- **Screenshot** at mobile 390 by 844 and desktop 1440 by 900, in **both Arabic and English**, then compare against the sketch and the direction. The main thread places the shots on the board as `type: "build"` (https links only); a subagent returns their paths.
- **Two rounds of fixes at most:** batch fixes between screenshots, do not screenshot after every tweak (Impeccable's two-round ceiling). In Finished mode, hand off to `gb-reviewer` for a fresh review.
- **Report** (a subagent returns it in its summary):
  - what was reused
  - what was added with the shadcn CLI
  - what was new
  - placeholders to replace
  - anything you could not check

---

## Sources

- shadcn Next.js install: https://ui.shadcn.com/docs/installation/next
- shadcn RTL (`rtl: true`, `migrate rtl`, Calendar, Pagination and Sidebar caveat, portals and `dir`): https://ui.shadcn.com/docs/rtl
- shadcn on React Aria (`init --base aria`, all eight styles): https://ui.shadcn.com/docs/changelog/2026-07-react-aria
- shadcn Base UI as the default (`-b radix` to keep Radix): https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- shadcn apply (switch presets in an existing project): https://ui.shadcn.com/docs/changelog/2026-04-shadcn-apply
- React Aria (30+ languages, 13 calendar systems, RTL): https://react-aria.adobe.com
- Library comparisons used as a cross-check only (vendor-written, weigh with care): https://www.untitledui.com/blog/shadcn-alternatives, https://heroui.com/en/blog/best-react-ui-component-libraries
- WCAG 2.2 (SC 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.5.8): https://www.w3.org/TR/WCAG22/
- Impeccable two-round ceiling and fresh reviewer: https://github.com/pbakaus/impeccable/blob/main/skill/reference/new-work.md
