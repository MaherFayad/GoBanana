/**
 * Data model, spec section 11. URLs and metadata only: no image bytes are
 * ever stored here (hard rule 2). Deleting a user cascades to every row they own;
 * their R2 objects are removed separately by the account deletion flow.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "pro_monthly", "pro_yearly", "founding"]);
export type Plan = (typeof planEnum.enumValues)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").notNull().unique(),
  /** Null only if the WorkOS lookup failed on first sight; filled in on a later request. */
  email: text("email"),
  plan: planEnum("plan").notNull().default("free"),
  paddleCustomerId: text("paddle_customer_id"),
  createdAt: createdAt(),
});

export const canvases = pgTable(
  "canvases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    brief: text("brief"),
    wildness: smallint("wildness"),
    lens: text("lens"),
    /** React Flow nodes + viewport. */
    state: jsonb("state").notNull().default({}),
    shareToken: text("share_token").unique(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("canvases_user_id_idx").on(t.userId)],
);

export const directions = pgTable(
  "directions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    /** Stable id from bend_brief (for example "bd-3kq9x1ma"), so agents can pass it as directionId. */
    bendId: text("bend_id"),
    move: text("move").notNull(),
    title: text("title").notNull(),
    searchQuery: text("search_query").notNull(),
    /**
     * Wild directions v2 detail (lib/direction-detail.ts DirectionDetail): platform, pages, visual
     * spec, art queries, twist, prompt, wildness, verdict. Null on rows saved before 0004.
     */
    detail: jsonb("detail"),
  },
  (t) => [
    index("directions_canvas_id_idx").on(t.canvasId),
    uniqueIndex("directions_canvas_bend_idx").on(t.canvasId, t.bendId),
    index("directions_bend_id_idx").on(t.bendId),
  ],
);

/**
 * Reference images: URLs only. Rows not placed on a canvas are purged after 30 days.
 * `result_id`, `lane`, `query`, `term_key` and `arm` record how a search found the row (null on
 * rows saved before 0003), so rate_references can credit the lane wording that found it.
 */
export const references = pgTable(
  "references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    sourceSite: text("source_site").notNull(),
    sourceUrl: text("source_url").notNull(),
    imageUrl: text("image_url").notNull(),
    thumbUrl: text("thumb_url").notNull(),
    title: text("title"),
    width: integer("width"),
    height: integer("height"),
    /** The search result id (`ref_...`) the row was saved from. */
    resultId: text("result_id"),
    /** Direction searches: the lane that found it ("fidelity", "taste", ...; older rows may say "inspiration"). */
    lane: text("lane"),
    /** The request words that found it, without negatives or the site operator. */
    query: text("query"),
    /** lib/learning/terms.ts term key of that lane ("fidelity|flight app ui"). */
    termKey: text("term_key"),
    /** lib/learning/arms.ts arm the lane used ("default", "raw@behance", "agent:..."). */
    arm: text("arm"),
    /** Search plan v2 (P1-I3): the Atlas query recipe whose words found it ("rc-..."); null otherwise. */
    recipeId: text("recipe_id"),
    /** Search plan v2: the Atlas card of the direction it was found for; null otherwise. */
    cardId: text("card_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("references_canvas_id_idx").on(t.canvasId),
    index("references_created_at_idx").on(t.createdAt),
    index("references_result_id_idx").on(t.resultId),
  ],
);

export const palettes = pgTable(
  "palettes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    colors: jsonb("colors").notNull(),
    contrast: jsonb("contrast").notNull(),
  },
  (t) => [index("palettes_canvas_id_idx").on(t.canvasId)],
);

/** The user's own images, stored in R2. */
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull().unique(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
  },
  (t) => [index("uploads_user_id_idx").on(t.userId)],
);

export const usage = pgTable(
  "usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** YYYY-MM */
    period: text("period").notNull(),
    searches: integer("searches").notNull().default(0),
    canvases: integer("canvases").notNull().default(0),
    /** Serper credits (provider requests) the user's searches spent this period. Read summed for the global cap. */
    serperCredits: integer("serper_credits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })],
);

/**
 * Install funnel (DIST-08): when each user first did each step. One row per user, written once per
 * step (the first time wins), no tracking scripts and no content. Read by scripts/funnel-report.mjs.
 */
export const installFunnel = pgTable("install_funnel", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstPingAt: timestamp("first_ping_at", { withTimezone: true }),
  firstCanvasAt: timestamp("first_canvas_at", { withTimezone: true }),
  firstKeepAt: timestamp("first_keep_at", { withTimezone: true }),
  firstExportAt: timestamp("first_export_at", { withTimezone: true }),
});

export const takedowns = pgTable("takedowns", {
  id: uuid("id").primaryKey().defaultRandom(),
  urlOrDomain: text("url_or_domain").notNull().unique(),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const takedownRequestStatusEnum = pgEnum("takedown_request_status", ["open", "accepted", "rejected"]);
export type TakedownRequestStatus = (typeof takedownRequestStatusEnum.enumValues)[number];

/**
 * Requests from the public takedown form. Kept apart from `takedowns` (the live block
 * list) so a request never blocks anything until the owner reviews it and adds an entry
 * to `takedowns` by hand. Holds the requester's name and email: never log these rows.
 */
export const takedownRequests = pgTable(
  "takedown_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The page or domain the request is about, as typed in the form. */
    url: text("url").notNull(),
    reason: text("reason").notNull(),
    name: text("name").notNull(),
    contactEmail: text("contact_email").notNull(),
    /** "owner" or "agent" (acting for the rights holder). */
    role: text("role").notNull(),
    details: text("details").notNull(),
    locale: text("locale").notNull().default("en"),
    status: takedownRequestStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("takedown_requests_status_created_idx").on(t.status, t.createdAt)],
);

export const feedbackVerdictEnum = pgEnum("feedback_verdict", ["great", "bad"]);

/**
 * One rate_references rating. Personal data (user id plus what they liked): removed with the user
 * (cascade) and after 12 months (lib/purge/feedback.ts, daily cron). Global learning reads these
 * rows grouped by term key and arm and never stores per-user aggregates (DECISIONS.md).
 */
export const searchFeedback = pgTable(
  "search_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Dribbble shot, Pinterest pin or Behance gallery key (lib/sources/web-search.ts itemKey). */
    itemKey: text("item_key").notNull(),
    sourceSite: text("source_site").notNull(),
    lane: text("lane"),
    query: text("query"),
    termKey: text("term_key"),
    arm: text("arm"),
    verdict: feedbackVerdictEnum("verdict").notNull(),
    reasons: text("reasons").array().notNull().default(sql`'{}'::text[]`),
    /** Creator parsed from the result title (lib/learning/creator.ts), for creator affinity. */
    creator: text("creator"),
    createdAt: createdAt(),
  },
  (t) => [
    index("search_feedback_user_created_idx").on(t.userId, t.createdAt),
    index("search_feedback_term_arm_idx").on(t.termKey, t.arm),
    index("search_feedback_created_at_idx").on(t.createdAt),
  ],
);

/** Items a user rated bad: never returned to them again by any search. Removed with the user. */
export const blockedItems = pgTable(
  "blocked_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemKey] })],
);

/**
 * Nightly learned weights (P2-01, lib/learning/nightly.ts): one Beta(alpha, beta) per ingredient
 * (`kind` "ingredient", id `direction|{ingredient}`) or lane arm (`kind` "arm", id
 * `{termKey}#{arm}`), built from search_feedback (rate_references and rate_directions). Pooled
 * across users and only for ids that at least K_ANON distinct users rated, so no user id and no
 * per-user count is stored here. Rewritten every night.
 */
export const atlasWeights = pgTable(
  "atlas_weights",
  {
    id: text("id").notNull(),
    kind: text("kind").notNull(),
    alpha: integer("alpha").notNull(),
    beta: integer("beta").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.id] })],
);

/**
 * One user's taste profile (P2-02, VAL-03): words and ids only, never images. `liked_card_ids`
 * are Atlas card ids the user kept, `style_words` are plain style words (from an agent, from
 * palettes of the user's own uploads or from a consented Pinterest import). `source_urls` holds
 * pin page links of a Pinterest import. Cleared from the account page; cascades with the user.
 */
export const userTaste = pgTable("user_taste", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  likedCardIds: text("liked_card_ids").array().notNull().default(sql`'{}'::text[]`),
  styleWords: text("style_words").array().notNull().default(sql`'{}'::text[]`),
  sourceUrls: text("source_urls").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Client review of a shared canvas (VAL-04, /s/[token]): one row per reviewer per direction, with a
 * keep or drop vote and a plain text comment. Reviewers do not sign in; `reviewer_key` is a random
 * id their browser makes (not an account, not an IP). Removed with the canvas. The owner sees these
 * rows as a separate source next to their own ratings; they never touch search_feedback.
 */
export const reviewFeedback = pgTable(
  "review_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    /** The direction's bend id, else its row id (same key rate_directions uses). */
    directionKey: text("direction_key").notNull(),
    reviewerKey: text("reviewer_key").notNull(),
    reviewerName: text("reviewer_name"),
    /** "keep", "drop" or null (comment only). */
    verdict: text("verdict"),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("review_feedback_reviewer_idx").on(t.canvasId, t.directionKey, t.reviewerKey),
    index("review_feedback_canvas_updated_idx").on(t.canvasId, t.updatedAt),
  ],
);

/**
 * The user's swipe file (VAL-09): parts and great references saved across boards. URLs, source
 * links, roles and crop rectangles only; never image bytes (hard rule 2). Removed with the user.
 * `item_key` dedupes (kind, source link, crop) per user.
 */
export const swipeItems = pgTable(
  "swipe_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    /** "part" (a crop of a reference) or "reference". */
    kind: text("kind").notNull(),
    /** Stitch part role (nav, hero...) for a part; null for a reference. */
    role: text("role"),
    /** Atlas card id, when the item came from one. */
    cardId: text("card_id"),
    sourceSite: text("source_site").notNull(),
    sourceUrl: text("source_url").notNull(),
    imageUrl: text("image_url").notNull(),
    thumbUrl: text("thumb_url").notNull(),
    title: text("title"),
    /** { x, y, w, h } as fractions, for a part. */
    crop: jsonb("crop"),
    note: text("note"),
    fromCanvasId: uuid("from_canvas_id").references(() => canvases.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("swipe_items_user_item_idx").on(t.userId, t.itemKey),
    index("swipe_items_user_created_idx").on(t.userId, t.createdAt),
    index("swipe_items_user_role_idx").on(t.userId, t.role),
  ],
);

export type User = typeof users.$inferSelect;
export type Canvas = typeof canvases.$inferSelect;
export type Direction = typeof directions.$inferSelect;
export type ReferenceRow = typeof references.$inferSelect;
export type Palette = typeof palettes.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type Usage = typeof usage.$inferSelect;
export type Takedown = typeof takedowns.$inferSelect;
export type TakedownRequestRow = typeof takedownRequests.$inferSelect;
export type SearchFeedbackRow = typeof searchFeedback.$inferSelect;
