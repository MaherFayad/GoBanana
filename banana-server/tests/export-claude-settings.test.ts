/** DIST-06: the claude_settings export offers the GoBanana plugin to a repo's teammates through .claude/settings.json. */
import { describe, expect, it } from "vitest";
import { exportKit } from "@/lib/export";
import { claudeSettingsFragment, mergeClaudeSettings } from "@/lib/export/claude-settings";
import { allowedExportFormats } from "@/lib/quota";
import { checkoutCanvas } from "./export-fixtures";

describe("claude_settings", () => {
  const [file] = exportKit(checkoutCanvas, ["claude_settings"]);

  it("is a JSON fragment for .claude/settings.json, marked to merge", () => {
    expect(file!.path).toBe(".claude/settings.json");
    expect(file!.mime).toBe("application/json");
    expect(file!.merge).toBe("json");
    expect(file!.append).toBeUndefined();
    expect(JSON.parse(file!.content)).toEqual({
      extraKnownMarketplaces: { gobanana: { source: { source: "github", repo: "MaherFayad/GoBanana" } } },
      enabledPlugins: { "gobanana@gobanana": true },
    });
  });

  it("is the same on every canvas (it has nothing to do with the board)", () => {
    expect(JSON.parse(file!.content)).toEqual(claudeSettingsFragment());
  });

  it("is free", () => {
    expect(allowedExportFormats("free")).toContain("claude_settings");
  });

  it("merges into existing settings without dropping anything", () => {
    const existing = {
      permissions: { allow: ["Bash(npm test)"] },
      extraKnownMarketplaces: { team: { source: { source: "github", repo: "acme/tools" } } },
      enabledPlugins: { "lint@team": true },
    };
    const merged = mergeClaudeSettings(existing);
    expect(merged.permissions).toEqual(existing.permissions);
    expect(merged.extraKnownMarketplaces).toEqual({ ...existing.extraKnownMarketplaces, ...claudeSettingsFragment().extraKnownMarketplaces });
    expect(merged.enabledPlugins).toEqual({ "lint@team": true, "gobanana@gobanana": true });
    // Running it again changes nothing.
    expect(mergeClaudeSettings(merged)).toEqual(merged);
    // An empty or missing file becomes the fragment.
    expect(mergeClaudeSettings(undefined)).toEqual(claudeSettingsFragment());
  });
});
