import { describe, expect, it } from "vitest";
import { isUrlOrDomain, parseTakedownForm } from "@/lib/site/takedown-form";
import { ar } from "@/lib/site/dict/ar";
import { en } from "@/lib/site/dict/en";

const valid = {
  name: "Sara Ali",
  email: "sara@example.com",
  target: "https://www.pinterest.com/pin/123/",
  reason: "copyright",
  role: "owner",
  details: "This is my illustration, posted without permission.",
  confirm: "on",
  locale: "ar",
};

describe("takedown form validation", () => {
  it("accepts a complete form post", () => {
    const result = parseTakedownForm(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.confirm).toBe(true);
      expect(result.data.locale).toBe("ar");
    }
  });

  it("accepts JSON booleans and a bare domain", () => {
    expect(parseTakedownForm({ ...valid, confirm: true, target: "example.com" }).ok).toBe(true);
  });

  it("trims values", () => {
    const result = parseTakedownForm({ ...valid, name: "  Sara  " });
    expect(result.ok && result.data.name).toBe("Sara");
  });

  it("reports one code per missing field", () => {
    const result = parseTakedownForm({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: "required",
        email: "required",
        target: "required",
        reason: "required",
        role: "required",
        details: "required",
        confirm: "must_confirm",
      });
    }
  });

  it("flags bad email, bad target, short details and no confirm", () => {
    const result = parseTakedownForm({
      ...valid,
      email: "not-an-email",
      target: "javascript:alert(1)",
      details: "short",
      confirm: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBe("invalid_email");
      expect(result.errors.target).toBe("invalid_target");
      expect(result.errors.details).toBe("too_short");
      expect(result.errors.confirm).toBe("must_confirm");
      expect(result.errors.name).toBeUndefined();
    }
  });

  it("rejects unknown reasons and roles, and overly long values", () => {
    const result = parseTakedownForm({ ...valid, reason: "spam", role: "someone", name: "x".repeat(201) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.reason).toBe("required");
      expect(result.errors.role).toBe("required");
      expect(result.errors.name).toBe("too_long");
    }
  });

  it("falls back to English for an unknown locale", () => {
    const result = parseTakedownForm({ ...valid, locale: "fr" });
    expect(result.ok && result.data.locale).toBe("en");
  });

  it("isUrlOrDomain", () => {
    expect(isUrlOrDomain("example.com")).toBe(true);
    expect(isUrlOrDomain("https://dribbble.com/shots/1")).toBe(true);
    expect(isUrlOrDomain("localhost")).toBe(false);
    expect(isUrlOrDomain("ftp://example.com")).toBe(false);
    expect(isUrlOrDomain("two words.com")).toBe(false);
    expect(isUrlOrDomain("1.2.3.4")).toBe(false);
  });

  it("every error code has English and Arabic text", () => {
    for (const code of ["required", "too_long", "too_short", "invalid_email", "invalid_target", "must_confirm"] as const) {
      expect(en.takedown.errors[code]).toBeTruthy();
      expect(ar.takedown.errors[code]).toBeTruthy();
    }
  });
});
