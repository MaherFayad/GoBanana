/**
 * claude_settings: the keys that make Claude Code offer the GoBanana plugin to everyone who opens
 * the repo (DIST-06). The agent merges them into the project's `.claude/settings.json` and never
 * replaces the file. After a teammate trusts the folder, Claude Code adds the marketplace and
 * prints the install command.
 *
 *   extraKnownMarketplaces: { gobanana: { source: { source: "github", repo: "MaherFayad/GoBanana" } } }
 *   enabledPlugins: { "gobanana@gobanana": true }
 */
import type { KitModel } from "./model";

/** The repository that holds the plugin marketplace (.claude-plugin/marketplace.json). */
export const PLUGIN_REPO = "MaherFayad/GoBanana";
/** Marketplace name (marketplace.json `name`) and plugin name. */
export const PLUGIN_MARKETPLACE = "gobanana";
export const PLUGIN_NAME = "gobanana";

export const CLAUDE_SETTINGS_PATH = ".claude/settings.json";

/** The settings keys to merge. The user's other keys, plugins and marketplaces stay. */
export function claudeSettingsFragment() {
  return {
    extraKnownMarketplaces: { [PLUGIN_MARKETPLACE]: { source: { source: "github", repo: PLUGIN_REPO } } },
    enabledPlugins: { [`${PLUGIN_NAME}@${PLUGIN_MARKETPLACE}`]: true },
  };
}

export function claudeSettingsJson(_m?: KitModel): string {
  return `${JSON.stringify(claudeSettingsFragment(), null, 2)}\n`;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Deep merge of the fragment into an existing settings object, as the agent does it. Objects
 * merge key by key; the fragment wins only on the keys it sets.
 */
export function mergeClaudeSettings(existing: unknown, fragment: Json = claudeSettingsFragment()): Json {
  const base: Json = isObject(existing) ? { ...existing } : {};
  for (const [key, value] of Object.entries(fragment)) {
    const current = base[key];
    base[key] = isObject(value) && isObject(current) ? mergeClaudeSettings(current, value) : value;
  }
  return base;
}
