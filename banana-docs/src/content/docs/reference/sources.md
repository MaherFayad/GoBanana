---
title: Sources
description: Every site search_references can search, which platform and zone each one feeds, the style words that pull it in, and the image hosts it loads from.
---

Every source is reached **only through web image search** with a `site:` filter. GoBanana never scrapes, never fetches pages and never stores images. A result is kept only if its link is one piece of work on that site (one shot, pin, site or screen); list, tag and search pages are dropped. Source of truth: `banana-server/lib/sources/registry.ts`.

## Core sources

Searched with UI wording on every platform. Pinterest and Behance also feed the art zone.

| Id | Site | Zone | Item pages |
| --- | --- | --- | --- |
| `pinterest` | Pinterest | UI and art | `pinterest.com/pin/…` |
| `dribbble` | Dribbble | UI | `dribbble.com/shots/…` |
| `behance` | Behance | UI and art | `behance.net/gallery/…` |
| `awwwards` | Awwwards | UI, websites | `awwwards.com/sites/…` |

## Web showcase styles

For a **website** brief that names one of these styles, the showcase galleries (Awwwards and Craftwork) come first and are searched with the style's own words, not the brief's topic. Mobile, tablet and web app briefs are not affected.

| Style | Words that name it | Awwwards searches | Craftwork searches |
| --- | --- | --- | --- |
| Playful | playful, fun, too fun, whimsical, quirky, cartoon | playful illustration | playful |
| WebGL | webgl, three.js, shader, real time 3d | webgl portfolio | webgl |
| 3D | 3d, three dimensional | 3d landing page | 3d |
| Scroll story | scroll story, scrollytelling, storytelling, immersive scroll, parallax | scroll storytelling | interactive |
| Kinetic type | kinetic type, kinetic typography, animated type | kinetic typography | (not searched) |
| Motion | motion, motion first, animated, animation, micro interactions | animation | animation |
| Interactive | interactive, gamified, playable | interactive | interactive |
| Experimental | experimental, avant garde, unconventional | experimental | (not searched) |

## UI galleries by platform

| Id | Site | Platform | Style words that pull it in |
| --- | --- | --- | --- |
| `lapa` | Lapa Ninja | Website | landing page |
| `siteinspire` | Siteinspire | Website | minimal, editorial, swiss style |
| `cssda` | CSS Design Awards | Website | award, immersive |
| `landinglove` | landing.love | Website | motion, animation, landing page |
| `unsection` | Unsection | Website | hero, section, pricing, features |
| `supahero` | Supahero | Website | hero, hero section |
| `thefwa` | The FWA | Website | immersive, 3d, motion, award |
| `httpster` | Httpster | Website | brutalist, typography, big typography, editorial |
| `darkdesign` | Dark Design | Website | dark mode, dark |
| `craftwork` | Craftwork (website inspiration) | Website, by showcase style only | playful, 3d, webgl, motion, interactive, scroll story |
| `21st` | 21st.dev (React and Tailwind components) | Website, web app | component, react, shadcn, hero section, animated |
| `refero` | Refero | Web app | |
| `saasframe` | SaaSFrame | Web app | |
| `nicelydone` | Nicelydone | Web app | |
| `screensdesign` | ScreensDesign | Mobile, tablet | |
| `figma` | Figma Community | Mobile, tablet | (titles must read as UI; kits and icon sets are dropped) |
| `bentogrids` | Bento Grids | Any, by style | bento grid, bento |
| `60fps` | 60fps | Any, by style | motion, animation, micro-interaction |

## Art galleries (art zone)

Picked when the direction's art queries or idea name their tags.

| Id | Site | Tags |
| --- | --- | --- |
| `fontsinuse` | Fonts In Use | typography, editorial, type, lettering, poster, serif, retro |
| `typoposters` | typo/graphic posters | poster, typography, swiss style, experimental |
| `swissted` | Swissted | swiss style, international style, punk |
| `brandidentity` | The Brand Identity | branding, identity, brand, luxury |
| `bpando` | BP&O | packaging, branding, label |
| `cosmos` | Cosmos | collage, moodboard, texture, grainy, y2k |
| `arena` | Are.na | collage, moodboard, experimental, archive |
| `designspiration` | Designspiration | poster, print, graphic design, illustration |

## Deck and brand briefs

A brief that names no phone, tablet, website or web app, but names a deck or a brand, gets its own lane instead of the UI lanes:

- **Presentation** (`deck` lane): pitch deck, keynote, slide layout, data slide, editorial deck, dark deck, big number slide. Searched on Dribbble, Behance, Pinterest and Pitch's template gallery, dark by default unless your taste or brief names another style.
- **Branding** (`brand` lane): brand identity, logo system, brand guidelines, visual identity, poster, packaging, typographic. Searched on The Brand Identity, BP&O, Brand New, Fonts In Use and typo/graphic posters first, then Behance, Dribbble and Pinterest.

Results must name the kind of work in their titles (a screen or app result is dropped); gallery items pass as they are. "Pitch deck for a fintech startup" and "packaging for an olive oil brand" use these lanes; "pitch deck builder web app" stays a web app brief.

| Id | Site | Genre | Item pages |
| --- | --- | --- | --- |
| `pitch` | Pitch templates | Presentation | `pitch.com/templates/…` |
| `brandnew` | Brand New (UnderConsideration) | Branding | `underconsideration.com/brandnew/archives/….php` |

## How a search picks sources

For one direction search the server picks:

1. **Up to 2 UI galleries**: first galleries whose style tags match the direction's style words or the brief (and suit the platform), then the galleries for the platform, rotated per direction so two directions on one board search different galleries.
2. **Up to 1 art gallery** whose tags the art queries name, plus Pinterest and Behance for the art lane.
3. **The core sources** for the UI lanes.

Pass `sources` (1 to 4 ids) to `search_references` only when you want specific sites.

## Image hosts

Images load in your browser straight from these hosts (also the canvas content security policy). If your network blocks one, its tiles show as link cards.

`i.pinimg.com` · `cdn.dribbble.com` · `mir-s3-cdn-cf.behance.net` · `mir-cdn.behance.net` · `assets.awwwards.com` · `cdn.lapa.ninja` · `r2.siteinspire.com` · `www.cssdesignawards.com` · `cssdesignawards.com` · `cdn.landing.love` · `unsection.b-cdn.net` · `pub-26e6aa63ed7942ecb7e9dbc72f09f164.r2.dev` (Supahero) · `thefwa.com` · `httpster.net` · `sidhvpjhuucqcehkevrl.supabase.co` (Dark Design) · `craftwork-products.b-cdn.net`, `marketstorage.b-cdn.net` and `curated-images.b-cdn.net` (Craftwork) · `bentogrids.com` · `cdn.21st.dev` · `images.refero.design` · `cdn.prod.website-files.com` (SaaSFrame) · `assets.nicelydone.club` · `media.screensdesign.com` · `video.gumlet.io` and `framerusercontent.com` (60fps) · `s3-alpha.figma.com` · `s3-figma-hubfile-images-production-cdn-cgi.figma.com` · `original.fontsinuse.com` · `assets.fontsinuse.com` · `images.typographicposters.com` · `assets.typographicposters.com` · `www.swissted.com` · `the-brandidentity.com` · `bpando.org` · `cdn.cosmos.so` · `d2w9rnfcy7mm78.cloudfront.net` and `images.are.na` (Are.na) · `dspncdn.com`

Deck and brand galleries also load from `imgproxy.services.pitch.com` and `pitch-static-assets.imgix.net` (Pitch) and `www.underconsideration.com` (Brand New).

## Adding a gallery source

New galleries are added on the server, one entry in the registry, after a live check of how many results are real item pages. Users cannot add sources themselves today. Suggest one through the contact on the [privacy page](https://gobanana-server.maherfayad55.workers.dev/en/privacy).
