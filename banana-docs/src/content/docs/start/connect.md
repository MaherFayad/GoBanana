---
title: Connect the MCP server
description: Add the GoBanana server to Claude apps, Claude Code, ChatGPT or Cursor.
---

Connect your agent to this server address. The Claude plugin adds the skills on top.

```text
https://gobanana-server.maherfayad55.workers.dev/api/mcp
```

Paste it wherever your agent asks for a custom connector or an MCP server. You sign in with OAuth the first time. There is no API key.

## Claude apps

1. Open **Settings**, then **Connectors**.
2. Choose **Add custom connector**.
3. Paste the server address, choose **Add**, and sign in when asked.

## Claude Code

1. Run this command in your terminal.

   ```bash
   claude mcp add --transport http gobanana https://gobanana-server.maherfayad55.workers.dev/api/mcp
   ```

2. Start Claude Code and run `/mcp` to sign in.

To get the skills too, install the plugin instead. See [Install the plugin in Claude](/docs/start/install/).

## ChatGPT

1. Open **Settings**, then **Apps and connectors**.
2. Under **Advanced settings**, turn on **Developer mode**.
3. Choose **Create**, paste the server address, and sign in when asked.

## Cursor

1. Open `~/.cursor/mcp.json`, or create it.
2. Add this config and save the file.

   ```json
   {
     "mcpServers": {
       "gobanana": {
         "url": "https://gobanana-server.maherfayad55.workers.dev/api/mcp"
       }
     }
   }
   ```

3. Sign in when Cursor asks.

## Check it works

Ask your agent to run the GoBanana `ping` tool. A good reply looks like this:

```text
Connected to GoBanana as you@example.com.
```

If it says you are not signed in, reconnect the server and sign in again. See [Troubleshooting](/docs/guides/troubleshooting/).
