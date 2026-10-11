---
title: Introduction
description: What GoBanana is, what it does, and what it never does.
---

GoBanana is an MCP server and a Claude plugin for wild design exploration. Ask your agent to "go wild" on a screen. GoBanana bends the brief into unexpected directions, finds UI references for them, and puts everything on a moodboard canvas.

Mobbin shows what works. GoBanana shows what's next.

## What it does

- **Bends a brief.** It turns a plain brief like "flight checkout screen" into directions, each with a title, a twist and a search query. See [Bend a brief into directions](/docs/guides/bend/).
- **Finds references.** It searches Pinterest, Dribbble, Behance and Awwwards for app screens, web pages, dashboards and components. Every result links to its source. See [Find and rate references](/docs/guides/references/).
- **Builds a board.** Directions become sections on a canvas. References, notes and color swatches sit inside them. The canvas opens inline in the chat and full screen on the web. See [Canvases and the dashboard](/docs/guides/canvases/).
- **Pulls a palette.** It extracts colors from your references and checks each pair against WCAG 2.2 contrast. See [Palette and contrast checks](/docs/guides/palette/).
- **Exports a kit.** DESIGN.md, AGENTS.md, design tokens, a Tailwind theme, a FigJam layout, an HTML board and a brief. See [Export a kit](/docs/guides/export/).

## How it works

Your agent does the thinking. GoBanana does the bending and the finding.

1. You write a brief in the chat.
2. The plugin's skills tell your agent which GoBanana tools to call, and in which order.
3. The server returns text and links. Your agent writes any files.

The server makes no AI calls. Bend moves are templates and word lists. There is no image generation.

## Images and sources

- GoBanana never downloads, stores or re-hosts reference images. It keeps links and titles only. Images load in your browser from their source.
- Every reference shows its source link: on the canvas, in share links, in every export and in every skill reply.
- There is no scraping. References come from web search results only.
- To build a palette, the server reads thumbnails in memory, computes the colors, then drops them.

If your work shows up and you want it gone, send a [takedown request](https://gobanana-server.maherfayad55.workers.dev/en/takedown).

## Which agents work with it

Claude, Claude Code, ChatGPT and Cursor, or any client that speaks MCP over HTTP. The Claude plugin adds 6 skills on top of the server. Other clients use the tools directly.

## Next

- [Install the plugin in Claude](/docs/start/install/)
- [Connect the MCP server](/docs/start/connect/)
