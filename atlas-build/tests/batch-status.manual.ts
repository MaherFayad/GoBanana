// Manual: print a batch's status without printing secrets. npx tsx tests/batch-status.manual.ts <batch id>
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "../config.ts";

loadEnv();
const b = await new Anthropic().messages.batches.retrieve(process.argv[2]!);
console.log(b.processing_status, JSON.stringify(b.request_counts), b.created_at);
