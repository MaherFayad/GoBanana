import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_HOSTS,
  bigEnough,
  hasUiWord,
  isUiResult,
  isItemPage,
  isJunk,
  mapSerperImagesWithStats,
  parseAllowlist,
  qualityScore,
  rankReferences,
  upgradeDribbbleImage,
  upgradePinterestImage,
  sizeRuleApplies,
  itemKey,
  type Reference,
  type SourceSite,
} from "@/lib/sources";
import { EMPTY_TAKEDOWNS } from "@/lib/takedown";

const allowlist = parseAllowlist(DEFAULT_IMAGE_HOSTS);
const item = (url: string, site: SourceSite) => isItemPage(new URL(url), site);

describe("single-item page filter", () => {
  it("keeps Dribbble shots only", () => {
    expect(item("https://dribbble.com/shots/23456789-Bakery-identity", "dribbble")).toBe(true);
    expect(item("https://dribbble.com/shots/23456789", "dribbble")).toBe(true);
    expect(item("https://www.dribbble.com/shots/1-x/attachments/2", "dribbble")).toBe(true);
    // Real bad pages from the first live board.
    expect(item("https://dribbble.com/search/3d", "dribbble")).toBe(false);
    expect(item("https://dribbble.com/search/shots/popular/web-design?q=velvet", "dribbble")).toBe(false);
    expect(item("https://dribbble.com/tags/care-label", "dribbble")).toBe(false);
    expect(item("https://dribbble.com/shots/popular", "dribbble")).toBe(false);
    expect(item("https://dribbble.com/someone", "dribbble")).toBe(false);
    expect(item("https://dribbble.com/someone/collections/123-ui", "dribbble")).toBe(false);
  });

  it("keeps Pinterest pins on every country subdomain, never boards or business pages", () => {
    for (const sub of ["www.", "", "es.", "jp.", "kr.", "in.", "de.", "cl.", "mx.", "nz.", "uk.", "fr.", "ie."]) {
      expect(item(`https://${sub}pinterest.com/pin/123456789012345678/`, "pinterest"), sub).toBe(true);
    }
    expect(item("https://www.pinterest.com/pin/AVb3xYz_1-q/", "pinterest")).toBe(true);
    // Real bad pages from the first live board.
    expect(item("https://business.pinterest.com/pinterest-palette/", "pinterest")).toBe(false);
    expect(item("https://www.pinterest.com/someuser/care-label-design/", "pinterest")).toBe(false);
    expect(item("https://help.pinterest.com/pin/1/", "pinterest")).toBe(false);
    expect(item("https://policy.pinterest.com/en/pin/1", "pinterest")).toBe(false);
    expect(item("https://newsroom.pinterest.com/pin/1", "pinterest")).toBe(false);
    expect(item("https://www.pinterest.com/ideas/care-label/123/", "pinterest")).toBe(false);
    expect(item("https://www.pinterest.com/search/pins/?q=sadu", "pinterest")).toBe(false);
    expect(item("https://pinterest.com.evil.example/pin/1/", "pinterest")).toBe(false);
  });

  it("keeps Behance galleries and Awwwards site and inspiration pages", () => {
    expect(item("https://www.behance.net/gallery/111/Bakery", "behance")).toBe(true);
    expect(item("https://www.behance.net/search/projects?search=sadu", "behance")).toBe(false);
    expect(item("https://www.behance.net/someone", "behance")).toBe(false);
    expect(item("https://www.awwwards.com/sites/some-studio-site", "awwwards")).toBe(true);
    expect(item("https://www.awwwards.com/inspiration/menu-hover-effect-x", "awwwards")).toBe(true);
    expect(item("https://www.awwwards.com/inspiration/search", "awwwards")).toBe(false);
    expect(item("https://www.awwwards.com/websites/e-commerce/", "awwwards")).toBe(false);
    expect(item("https://www.awwwards.com/blog/something", "awwwards")).toBe(false);
  });
});

describe("junk filter", () => {
  it.each([
    "Traditional Folk Sadu Arabian Hand Weaving Stock Vector (Royalty Free) 471497108 | Shutterstock",
    "Passport Stamp SVG Bundle: Travel Icons, Visa Stamps (Digital Download)",
    "Gold Boarding Pass Wedding Invitation Template | Canva",
    "Dubai Holiday Reveal Boarding Pass Printable Ticket - Etsy UK",
    "Boarding Pass Ticket Save the Date Gold Plane Card | Zazzle",
    "Label tag wash instruction cloth care fabric cotton isolated set graphic design illustration | Premium Vector",
    "11 Care Label Design ideas | care label, label design, clothing labels",
    "Browse thousands of Best 3D images for design inspiration | Dribbble",
    "Sadu pattern clipart",
    "Velvet texture Stock Photo | iStock",
    "Editable boarding pass template",
  ])("drops %s", (title) => {
    expect(isJunk({ title })).toBe(true);
  });

  it("checks the source and URLs too, and keeps real work", () => {
    expect(isJunk({ title: "Nice", source: "Freepik" })).toBe(true);
    expect(isJunk({ title: "Nice", sourceUrl: "https://www.pinterest.com/pin/1/", imageUrl: "https://i.etsystatic.com/x.jpg" })).toBe(true);
    expect(isJunk({ title: "Flight booking app UI concept", source: "Dribbble" })).toBe(false);
    expect(isJunk({ title: "Banking dashboard UI kit template" })).toBe(false);
    expect(isJunk({ title: "Canvas app onboarding" })).toBe(false);
    expect(isJunk({})).toBe(false);
  });

  it("drops small images only when the size is known", () => {
    expect(bigEnough(236, 300)).toBe(false);
    expect(bigEnough(474, 599)).toBe(false);
    expect(bigEnough(400, 600)).toBe(true);
    expect(bigEnough(undefined, 300)).toBe(true);
    expect(bigEnough(undefined, undefined)).toBe(true);
  });
});

describe("image upgrades", () => {
  it("asks i.pinimg.com for the 736x file and scales a bucket-sized result", () => {
    const up = upgradePinterestImage(new URL("https://i.pinimg.com/236x/aa/bb/cc/hash.jpg"), 236, 354);
    expect(up).toEqual({ url: "https://i.pinimg.com/736x/aa/bb/cc/hash.jpg", width: 736, height: 1104 });
    expect(upgradePinterestImage(new URL("https://i.pinimg.com/474x/aa/hash.jpg"), 400, 300)).toEqual({
      url: "https://i.pinimg.com/736x/aa/hash.jpg",
      width: 400,
      height: 300,
    });
    expect(upgradePinterestImage(new URL("https://i.pinimg.com/564x/aa/hash.jpg")).url).toBe("https://i.pinimg.com/736x/aa/hash.jpg");
    expect(upgradePinterestImage(new URL("https://i.pinimg.com/originals/aa/hash.jpg"), 900, 900).url).toBe(
      "https://i.pinimg.com/originals/aa/hash.jpg",
    );
  });

  it("strips ?resize from cdn.dribbble.com and forgets the resized size", () => {
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/userupload/1/file/original-a.png?resize=400x300&vertical=center"), 400, 300)).toEqual({
      url: "https://cdn.dribbble.com/userupload/1/file/original-a.png?vertical=center",
    });
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/u/a.png?resize=752x"), 752, 564)).toEqual({ url: "https://cdn.dribbble.com/u/a.png" });
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/u/a.png"), 500, 400)).toEqual({ url: "https://cdn.dribbble.com/u/a.png", width: 500, height: 400 });
    expect(sizeRuleApplies("https://cdn.dribbble.com/u/a.png")).toBe(false);
    expect(sizeRuleApplies("https://i.pinimg.com/736x/a.jpg")).toBe(true);
  });

  it("applies upgrades in mapping, keeps the thumb, and drops board pages with 236x images", () => {
    const thumb = "https://encrypted-tbn0.gstatic.com/images?q=1";
    const { references, dropped } = mapSerperImagesWithStats(
      [
        { title: "11 Care Label Design ideas | labels", link: "https://www.pinterest.com/someone/care-labels/", imageUrl: "https://i.pinimg.com/236x/aa/board.jpg", imageWidth: 236, imageHeight: 236, thumbnailUrl: thumb },
        { title: "Woven care label app", link: "https://es.pinterest.com/pin/42/", imageUrl: "https://i.pinimg.com/236x/aa/pin.jpg", imageWidth: 236, imageHeight: 300, thumbnailUrl: thumb },
        { title: "Laundry app shot", link: "https://dribbble.com/shots/7-x", imageUrl: "https://cdn.dribbble.com/u/7.png?resize=400x300", imageWidth: 400, imageHeight: 300, thumbnailUrl: "https://encrypted-tbn1.gstatic.com/images?q=7" },
        { title: "Tiny app UI", link: "https://dribbble.com/shots/8-x", imageUrl: "https://cdn.dribbble.com/u/8.png", imageWidth: 300, imageHeight: 200 },
        { title: "Gold boarding pass | Zazzle", link: "https://www.pinterest.com/pin/9/", imageUrl: "https://i.pinimg.com/736x/aa/z.jpg", imageWidth: 736, imageHeight: 900 },
      ],
      { sources: ["pinterest", "dribbble"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10 },
    );
    // Board page, Zazzle listing. The 300 px Dribbble shot stays: Dribbble sizes are of resized variants.
    expect(dropped).toBe(2);
    expect(references.some((r) => r.sourceUrl === "https://dribbble.com/shots/8-x")).toBe(true);
    const pin = references.find((r) => r.sourceUrl === "https://es.pinterest.com/pin/42/")!;
    expect(pin).toMatchObject({ imageUrl: "https://i.pinimg.com/736x/aa/pin.jpg", thumbUrl: thumb, width: 736, height: 936 });
    const shot = references.find((r) => r.sourceUrl === "https://dribbble.com/shots/7-x")!;
    expect(shot.imageUrl).toBe("https://cdn.dribbble.com/u/7.png");
    expect(shot.thumbUrl).toBe("https://encrypted-tbn1.gstatic.com/images?q=7");
    expect(shot.width).toBeUndefined();
  });
});

describe("UI title gate", () => {
  it("keeps titles that name a UI", () => {
    for (const title of [
      "Flight Booking App UI by X on Dribbble",
      "Banking Dashboard",
      "Real Estate Website Design",
      "Meditation app onboarding",
      "Crypto wallet widget",
      "Food delivery checkout screen",
      "SaaS landing page",
      "Fitness tracker",
    ]) {
      expect(isUiResult(title, "https://dribbble.com/shots/1-x"), title).toBe(true);
    }
  });

  it("drops titles that name no UI, or other design work without app, ui, dashboard or website", () => {
    for (const title of [
      "Uzbek suzani jacket",
      "Gas station sign",
      "Teletext 1980s",
      "Delta airline logo",
      "Coffee branding",
      "Movie poster",
      "Bakery identity mobile mockup",
      "Character illustration for onboarding screens",
    ]) {
      expect(isUiResult(title, "https://dribbble.com/shots/1-x"), title).toBe(false);
    }
  });

  it("keeps a title with a non-UI word when it also says app, ui, dashboard or website", () => {
    expect(isUiResult("Coffee shop branding app UI", "https://dribbble.com/shots/1-x")).toBe(true);
    expect(isUiResult("Logo and website for a bakery", "https://dribbble.com/shots/1-x")).toBe(true);
    expect(isUiResult("Poster app", "https://dribbble.com/shots/1-x")).toBe(true);
  });

  it("drops untitled results and matches whole words only", () => {
    expect(isUiResult(undefined, "https://www.pinterest.com/pin/1/")).toBe(false);
    expect(isUiResult("", "https://www.pinterest.com/pin/1/")).toBe(false);
    expect(isUiResult("   ", "https://www.pinterest.com/pin/1/")).toBe(false);
    expect(isUiResult("Happy guide", "https://dribbble.com/shots/1-x")).toBe(false);
    expect(isUiResult("Build a web site", "https://dribbble.com/shots/1-x")).toBe(true);
    expect(isUiResult("Sign up flow", "https://dribbble.com/shots/1-x")).toBe(true);
    expect(isUiResult("APP", "https://dribbble.com/shots/1-x")).toBe(true);
  });

  it("keeps a titled Awwwards site page: it is a website", () => {
    expect(isUiResult("Lusion", "https://www.awwwards.com/sites/lusion")).toBe(true);
    expect(isUiResult("", "https://www.awwwards.com/sites/lusion")).toBe(false);
    expect(isUiResult("Logo reveal", "https://www.awwwards.com/inspiration/logo-reveal")).toBe(false);
  });

  it("knows a UI word in a query", () => {
    expect(hasUiWord("banking app home")).toBe(true);
    expect(hasUiWord("teletext 1980s")).toBe(false);
    expect(hasUiWord(undefined)).toBe(false);
  });

  it("drops non-UI titles in mapping and counts them", () => {
    const { references, dropped } = mapSerperImagesWithStats(
      [
        { title: "Uzbek suzani jacket", link: "https://www.pinterest.com/pin/1/", imageUrl: "https://i.pinimg.com/736x/a.jpg", imageWidth: 736, imageHeight: 900 },
        { title: "", link: "https://www.pinterest.com/pin/2/", imageUrl: "https://i.pinimg.com/736x/b.jpg", imageWidth: 736, imageHeight: 900 },
        { link: "https://www.pinterest.com/pin/3/", imageUrl: "https://i.pinimg.com/736x/c.jpg", imageWidth: 736, imageHeight: 900 },
        { title: "Banking Dashboard", link: "https://www.pinterest.com/pin/4/", imageUrl: "https://i.pinimg.com/736x/d.jpg", imageWidth: 736, imageHeight: 900 },
      ],
      { sources: ["pinterest"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10 },
    );
    expect(references.map((r) => r.title)).toEqual(["Banking Dashboard"]);
    expect(dropped).toBe(3);
  });
});

describe("dedupe keys", () => {
  it("names one piece of work the same on every subdomain and slug", () => {
    expect(itemKey("https://es.pinterest.com/pin/42/")).toBe(itemKey("https://www.pinterest.com/pin/42/"));
    expect(itemKey("https://dribbble.com/shots/7-a")).toBe(itemKey("https://dribbble.com/shots/7-b-c"));
    expect(itemKey("https://www.behance.net/gallery/9/x")).toBe("behance:9");
    expect(itemKey("https://www.awwwards.com/sites/a")).not.toBe(itemKey("https://www.awwwards.com/sites/b"));
  });
});

describe("ranking", () => {
  const ref = (over: Partial<Reference>): Reference => ({
    id: `ref_${over.sourceUrl ?? "x"}`,
    thumbUrl: "https://i.pinimg.com/t.jpg",
    imageUrl: "https://i.pinimg.com/i.jpg",
    sourceUrl: "https://www.pinterest.com/pin/1/",
    sourceSite: "pinterest.com",
    ...over,
  });

  it("puts large design work above small product listings, curated sites above repins", () => {
    const listing = ref({ sourceUrl: "a", title: "Boarding pass sticker gift", width: 736, height: 736 });
    const pin = ref({ sourceUrl: "b", title: "Boarding pass", width: 736, height: 1104 });
    const shot = ref({ sourceUrl: "c", sourceSite: "dribbble.com", title: "Boarding pass", width: 736, height: 1104 });
    const ui = ref({ sourceUrl: "d", title: "Flight booking app UI", width: 1600, height: 1200 });
    expect(rankReferences([listing, pin, shot, ui]).map((r) => r.sourceUrl)).toEqual(["d", "c", "b", "a"]);
  });

  it("nudges uncluttered single components up and multi-screen kits down", () => {
    const card = ref({ sourceUrl: "a", title: "Wallet card UI, minimal", width: 1200, height: 900 });
    const kit = ref({ sourceUrl: "b", title: "Wallet app UI kit, 60 screens", width: 1200, height: 900 });
    expect(qualityScore(card)).toBeGreaterThan(qualityScore(kit));
    expect(rankReferences([kit, card]).map((r) => r.sourceUrl)).toEqual(["a", "b"]);
  });

  it("is deterministic: ties keep the search order", () => {
    const a = ref({ sourceUrl: "a" });
    const b = ref({ sourceUrl: "b" });
    const c = ref({ sourceUrl: "c" });
    expect(rankReferences([b, a, c]).map((r) => r.sourceUrl)).toEqual(["b", "a", "c"]);
    expect(rankReferences([b, a, c])).toEqual(rankReferences([b, a, c]));
  });
});
