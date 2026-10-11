import { APP_NAME } from "@/lib/config";

// Placeholder home page until the site pages land (M7/M8).
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <h1>{APP_NAME}</h1>
      <p>Wild design references and a moodboard canvas for your AI agent.</p>
      <p>
        Connect your agent to <code>/api/mcp</code> to get started.
      </p>
    </main>
  );
}
