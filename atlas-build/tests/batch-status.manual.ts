// Manual: print a batch's status without printing secrets, or cancel it.
//   npx tsx tests/batch-status.manual.ts <batch id> [--cancel]
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "../config.ts";

loadEnv();
const client = new Anthropic();
const id = process.argv[2]!;
const b = process.argv.includes("--cancel") ? await client.messages.batches.cancel(id) : await client.messages.batches.retrieve(id);
console.log(b.processing_status, JSON.stringify(b.request_counts), b.created_at);
