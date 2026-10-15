/**
 * Checks the models in config.ts against the key: lists GET /v1/models, confirms OPUS, SONNET and
 * HAIKU are there, and sends one tiny image to the JUDGE model to prove it reads images (about a
 * cent). Writes data/models.json. Run: `npm run models`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { HAIKU, JUDGE, OPUS, PATHS, SONNET, loadEnv } from "./config.ts";
import { logUsage, usageCost } from "./lib/guard.ts";
import { deflateSync } from "node:zlib";

/** A solid-color PNG built in memory (no file), so the test needs no image on disk. */
export function solidPng(size: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function main(): Promise<void> {
  loadEnv();
  const client = new Anthropic();
  const listed: Array<{ id: string; display_name: string; capabilities?: unknown; max_input_tokens?: unknown; max_tokens?: unknown }> = [];
  for await (const m of client.models.list()) listed.push(m as (typeof listed)[number]);
  const ids = listed.map((m) => m.id);
  const wanted = { OPUS, SONNET, HAIKU };
  const missing = Object.entries(wanted).filter(([, id]) => !ids.includes(id));
  console.log(`The key lists ${ids.length} models.`);
  for (const [name, id] of Object.entries(wanted)) console.log(`  ${name} = ${id}: ${ids.includes(id) ? "available" : "MISSING"}`);

  // One image test on the judging model: a red square, asked for its color.
  const png = solidPng(64, [220, 30, 30]);
  const m = await client.messages.create({
    model: JUDGE,
    max_tokens: 1024,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
          { type: "text", text: "What color is this square? Answer with one word." },
        ],
      },
    ],
  });
  const answer = m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  const usd = usageCost(JUDGE, m.usage, false);
  logUsage(PATHS.costs, {
    job: "models",
    request: "image-test",
    model: m.model,
    mode: "direct",
    input_tokens: m.usage.input_tokens,
    cache_write_tokens: m.usage.cache_creation_input_tokens ?? 0,
    cache_read_tokens: m.usage.cache_read_input_tokens ?? 0,
    output_tokens: m.usage.output_tokens,
    usd,
  });
  const imageOk = /red/i.test(answer);
  console.log(`Image test on ${JUDGE}: answered "${answer}" (${imageOk ? "reads images" : "UNEXPECTED"}), $${usd.toFixed(4)}.`);

  const out = {
    checked: new Date().toISOString().slice(0, 10),
    config: wanted,
    judge: { model: JUDGE, imageTest: { answer, ok: imageOk } },
    models: listed.filter((x) => Object.values(wanted).includes(x.id)),
    allIds: ids,
  };
  mkdirSync(dirname(PATHS.models), { recursive: true });
  writeFileSync(PATHS.models, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${PATHS.models}`);
  if (missing.length > 0 || !imageOk) process.exit(1);
}

await main();
