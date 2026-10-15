---
name: gobanana-culture
description: Use cultural and heritage references with meaning and care. Use when the user names a culture, region, tradition, craft, script or occasion ("make it feel Saudi", "sadu", "Najdi doors", "Kufic", "Ramadan", "National Day", "Japanese", "Mexican folk art"), when a bend uses a lens, or when a reference on the board shows a cultural motif. It names the tradition exactly, rates how sensitive it is, turns its grammar (not its artifacts) into UI parts, writes meaning and credit notes on the board, and adds a Cultural brief to the hand-off. Runs get_canvas, get_snapshot, bend_brief, search_references, rate_references, add_to_canvas and export_kit from the GoBanana MCP server.
---

# GoBanana culture

Goal: borrow from a culture the way a good guest does. Know what a thing means before using how it
looks. Take its grammar (rhythm, proportion, color ratios, how it is made), never copy a specific
artwork, and say where it comes from.

## When to run

- The user names a culture, region, craft, script, festival or national occasion.
- `bend_brief` ran with a `lens`, or returned a "tradition" ingredient.
- A placed reference shows a motif, script, costume, building or symbol from a specific culture.
- The user asks to "make it feel local", "add heritage", or "Arabic style".

## Rules (never break)

1. **Meaning before motif.** Never place a cultural reference without a one-line meaning.
2. **Name it exactly.** Give the tradition, the region, the people who make it, the medium, and its
   English and Arabic names. Write "Al Sadu weaving (السدو), Bedouin weaving of the Arabian Peninsula",
   not "Arabic pattern". If you cannot identify it with confidence, write "origin not identified" and do
   not guess.
3. **Sort it by sensitivity tier:**
   - **Open:** everyday crafts and forms (woven bands, embroidery, painted wall bands, door and window
     geometry, architecture). Abstract it freely and credit it.
   - **Care:** marks tied to a living community or family (tribal marks, family patterns, specific
     regional dress, a named maker's work). Use the grammar, not the exact mark. Credit it, and suggest
     a reviewer from that community.
   - **Sacred or protected:** religious text and symbols (Quran verses, the shahada, names of God,
     mosque or Kaaba imagery used as decoration, depictions of prophets), and national flags and
     emblems. Never use them as decoration, texture or pattern. Never crop or alter them. If asked,
     decline in one line and offer an alternative.
4. **Grammar, not artifact.** Extract rhythm, repeat, proportion, color ratio, construction logic and
   story. Never trace, copy or reuse a reference image as a design element.
5. **No clichés unless the user asks.** No camels, dunes, oil, lanterns, "Arabian Nights" lettering or
   generic arabesque as shorthand for a whole region. The same applies to every culture's tourist
   clichés.
6. **Real script only.** Arabic must be real, readable words chosen with the user, correctly shaped and
   joined, right to left. No fake Arabic-looking Latin fonts, no random letters used as pattern, no
   disconnected letters. No tashkeel unless it is truly needed. Calligraphic styles (square Kufic,
   Thuluth, Diwani) carry real words.
7. **Region precision.** The Gulf is not the Levant, the Maghreb, Turkey or Iran. For a Gulf brief, stay
   with Gulf traditions unless the user asks for wider.
8. **Credit everywhere.** On the board note and in the hand-off.

## Workflow

1. **Read** the board with `get_canvas` (summary first) and the brief. If the culture or region is
   unclear, ask one question. Otherwise go on.
2. **Identify** each cultural lens, ingredient or reference: tradition, region, community, medium, era,
   English and Arabic names, and tier. Look at the thumbnail (`get_snapshot`) before you decide; never
   judge from the title alone.
3. **Find meaning from a real source:** a museum page, the UNESCO Intangible Cultural Heritage list, or
   a national cultural institution. Put the link in the note. Prefer museum and CC0 sources for the art
   zone.
4. **Map grammar to UI.** Write a small table for each kept direction: source element, its grammar, and
   the UI part it becomes. Examples:

   | Source element | Grammar | UI part |
   | --- | --- | --- |
   | Sadu bands | Stacked horizontal bands, small triangles, strict repeat | Section dividers, tab bar edge, progress |
   | Talli braid | A narrow strip of crossing strands | Step indicator, loading strip, progress |
   | Qatt Asiri wall painting | Painted color bands and triangles, hand-made unevenness | Headers, card edges, empty states |
   | Roshan or mashrabiya | Lattice that filters light and keeps privacy | Image masks, overlays, modal backdrops |
   | Najdi doors | Painted geometry on wooden panels | Entry screens, card covers, onboarding |
   | Square Kufic | Real words built on a square grid | Wordmarks and section titles, with words the user picks |

5. **Color with care.** Take color ratios from the source, then check contrast with `gobanana-palette`
   (WCAG 2.2 SC 1.4.3 for text, SC 1.4.11 for UI parts). Flag any combination that reads as a national
   flag or a religious symbol, and do not use it as a casual accent.
6. **Write notes** on every cultural item with `add_to_canvas`, as four short lines (pass the server's
   `culture` object too when the tool supports it):
   - `meaning:` what it is and what it stands for
   - `steal:` the grammar you take
   - `credit:` tradition, people, source link
   - `care:` the tier and any limit
7. **Rate.** Use `rate_references` with "bad" for stereotypes, fake script, sacred or national symbols
   used as decoration, and references with a wrong or unclear origin.
8. **Hand off.** Run `export_kit` and make sure DIRECTION.md (or CULTURE.md, when the server exports it)
   starts with a **Cultural brief**:
   - tradition
   - tier
   - what we use
   - what we avoid
   - credit line
   - sources
   - suggested reviewer
9. **Suggest a review.** Recommend a reviewer from the community, required for the Care tier. Give them
   three questions:
   - Is the meaning right?
   - Is anything used in a way that would offend?
   - Is the credit right?

## Occasions

Ramadan, Eid, Saudi National Day (23 September) and Founding Day (22 February) each have their own
visual codes, and official identities are published for the national days. Check the current year's
official guideline before you use them. Do not mix the codes of different occasions.

## Saying no well

Keep it to one line, then offer something better.

- English: "I won't use Quran verses as a pattern, but I can build a square Kufic grid from words you
  choose."
- Arabic (white Saudi dialect, no tashkeel): "ما نقدر نستخدم الآيات كزخرفة، لكن نقدر نسوي شبكة كوفي مربع
  بكلمات تختارها."

## Checklist before you show the board

- [ ] Every cultural item has meaning, steal, credit and care lines.
- [ ] No sacred text, religious symbol, flag or emblem is used as decoration.
- [ ] All Arabic is real, readable and correctly joined.
- [ ] The region matches the brief.
- [ ] No clichés unless the user asked.
- [ ] Contrast is checked for ship colors.
- [ ] The hand-off starts with a Cultural brief.
