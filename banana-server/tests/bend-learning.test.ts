/**
 * Ingredient weighting from rate_directions feedback (lib/learning/directions.ts) and how
 * bend_brief uses it: deterministic, k >= 3 distinct users before anyone else is steered,
 * GLOBAL_LEARNING off means own ratings only, and any stats failure falls back to plain bends.
 */
import { describe, expect, it, vi } from "vitest";
import { bendBrief } from "@/lib/bend";
import { createBendBriefTool } from "@/lib/mcp/tools/bend_brief";
import {
  INGREDIENT_FLOOR,
  ingredientWeight,
  ingredientWeights,
  weightedOrder,
  type IngredientStat,
} from "@/lib/learning/directions";
import { directionTermKey } from "@/lib/learning/terms";
import type { NewFeedback } from "@/lib/db/types";
import { ALICE, BOB, makeDeps } from "./tools-fixtures";

const CAROL = "44444444-4444-4444-8444-444444444444";
const DAVE = "55555555-5555-4555-8555-555555555555";

const stat = (termKey: string, over: Partial<IngredientStat> = {}): IngredientStat => ({
  termKey,
  great: 0,
  bad: 0,
  users: 0,
  ownGreat: 0,
  ownBad: 0,
  ...over,
});

const BRIEF = { brief: "Flight checkout screen for a GCC travel OTA", wildness: 4 as const, count: 8 };
const leads = (weights?: Map<string, number>) => bendBrief(BRIEF, weights ? { ingredientWeights: weights } : {}).directions.map((d) => d.searchQuery);

describe("ingredient weights", () => {
  it("weighs an unseen ingredient 1, a kept one more, a dropped one less, never under the floor", () => {
    expect(ingredientWeight(null)).toBe(1);
    expect(ingredientWeight({ great: 0, bad: 0 })).toBe(1);
    expect(ingredientWeight({ great: 4, bad: 0 })).toBeGreaterThan(1);
    expect(ingredientWeight({ great: 0, bad: 2 })).toBeLessThan(1);
    expect(ingredientWeight({ great: 0, bad: 2 })).toBeGreaterThan(ingredientWeight({ great: 0, bad: 6 }));
    expect(ingredientWeight({ great: 0, bad: 50 })).toBe(INGREDIENT_FLOOR);
    expect(INGREDIENT_FLOOR).toBe(0.15);
  });

  it("uses other users' ratings only from 3 distinct users, own ratings always, none when global learning is off", () => {
    const tk = directionTermKey("vending machine");
    expect(tk).toBe("direction|vending machine");
    // Two other users dropped it: not enough to steer anyone else.
    expect(ingredientWeights([stat(tk, { bad: 2, users: 2 })], { global: true }).size).toBe(0);
    // Three did: it steers everyone.
    expect(ingredientWeights([stat(tk, { bad: 3, users: 3 })], { global: true }).get(tk)).toBeLessThan(1);
    // The user's own drops always apply to them.
    expect(ingredientWeights([stat(tk, { bad: 1, users: 1, ownBad: 2 })], { global: true }).get(tk)).toBeLessThan(1);
    // GLOBAL_LEARNING off: only own ratings.
    expect(ingredientWeights([stat(tk, { bad: 9, users: 9 })], { global: false }).size).toBe(0);
    expect(ingredientWeights([stat(tk, { bad: 9, users: 9, ownBad: 1 })], { global: false }).get(tk)).toBeLessThan(1);
  });

  it("reorders without random draws: weight 1 keeps the order, a low weight sinks an item", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(weightedOrder(items, () => 1)).toEqual(items);
    const sunk = weightedOrder(items, (x) => (x === "a" ? INGREDIENT_FLOOR : 1));
    expect(sunk.indexOf("a")).toBeGreaterThan(0);
    expect(sunk.filter((x) => x !== "a")).toEqual(items.slice(1));
    expect(weightedOrder(items, (x) => (x === "a" ? INGREDIENT_FLOOR : 1))).toEqual(sunk);
    const raised = weightedOrder(items, (x) => (x === "c" ? 2 : 1));
    expect(raised.indexOf("c")).toBeLessThan(2);
  });
});

describe("bend with ingredient weights", () => {
  it("is unchanged with no feedback", () => {
    const plain = bendBrief(BRIEF);
    expect(bendBrief(BRIEF, {})).toEqual(plain);
    expect(bendBrief(BRIEF, { ingredientWeights: new Map() })).toEqual(plain);
    // Weights for ingredients that are not candidates change nothing either.
    expect(bendBrief(BRIEF, { ingredientWeights: new Map([["direction|not a real ingredient", 0.15]]) })).toEqual(plain);
  });

  it("makes often dropped ingredients rare, deterministically for the same weights", () => {
    const base = leads();
    const dropped = new Map(base.map((q) => [directionTermKey(q), INGREDIENT_FLOOR]));
    const once = leads(dropped);
    expect(leads(dropped)).toEqual(once);
    const stillThere = once.filter((q) => base.includes(q)).length;
    expect(stillThere).toBeLessThan(base.length / 2);
    // Never impossible: the weight floor keeps them in the pools.
    for (const w of dropped.values()) expect(w).toBeGreaterThan(0);
  });
});

describe("bend_brief reads direction stats", () => {
  /** Rows as rate_directions writes them. */
  const drop = (userId: string, ingredient: string, n = 1): NewFeedback[] =>
    Array.from({ length: n }, () => ({
      userId,
      itemKey: "bd-x",
      sourceSite: "bend",
      lane: "direction",
      query: ingredient.toLowerCase(),
      termKey: directionTermKey(ingredient),
      arm: "material",
      verdict: "bad" as const,
      reasons: ["no_ui_path" as const],
      creator: null,
    }));

  const setup = (globalLearning = true) => {
    const { repos } = makeDeps();
    const spy = vi.spyOn(repos.feedback, "directionStats");
    const bend = createBendBriefTool(() => ({ repos, globalLearning: () => globalLearning }));
    const run = async (userId?: string) =>
      ((await bend(BRIEF, userId)).structuredContent as { directions: { searchQuery: string }[] }).directions.map((d) => d.searchQuery);
    return { repos, spy, run };
  };

  it("reads the stats once per call and changes nothing without feedback", async () => {
    const s = setup();
    expect(await s.run(ALICE)).toEqual(leads());
    expect(s.spy).toHaveBeenCalledTimes(1);
    expect(s.spy).toHaveBeenCalledWith(ALICE, 3);
    // No user: no database read at all.
    expect(await s.run()).toEqual(leads());
    expect(s.spy).toHaveBeenCalledTimes(1);
  });

  it("applies a user's own drops to them, and to others only after 3 users dropped it", async () => {
    const s = setup();
    const base = leads();
    for (const q of base) await s.repos.feedback.insertMany(drop(ALICE, q, 2));
    const alice = await s.run(ALICE);
    expect(alice).not.toEqual(base);
    expect(await s.run(ALICE)).toEqual(alice);
    // Bob is not steered by one other user's ratings.
    expect(await s.run(BOB)).toEqual(base);
    for (const u of [CAROL, DAVE]) for (const q of base) await s.repos.feedback.insertMany(drop(u, q));
    expect(await s.run(BOB)).not.toEqual(base);
  });

  it("with GLOBAL_LEARNING off only the user's own drops count", async () => {
    const s = setup(false);
    const base = leads();
    for (const u of [ALICE, CAROL, DAVE]) for (const q of base) await s.repos.feedback.insertMany(drop(u, q));
    expect(await s.run(BOB)).toEqual(base);
    expect(await s.run(ALICE)).not.toEqual(base);
  });

  it("fails open when the stats cannot be read", async () => {
    const s = setup();
    s.spy.mockRejectedValue(new Error("db down at 10.0.0.1"));
    const res = await createBendBriefTool(() => ({ repos: s.repos }))(BRIEF, ALICE);
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as { directions: { searchQuery: string }[] }).directions.map((d) => d.searchQuery)).toEqual(leads());
    const broken = createBendBriefTool(() => {
      throw new Error("DATABASE_URL is not set");
    });
    const res2 = await broken(BRIEF, ALICE);
    expect(res2.isError).toBeFalsy();
  });
});
