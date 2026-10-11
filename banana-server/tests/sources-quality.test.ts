import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_HOSTS,
  bigEnough,
  isItemPage,
  isJunk,
  mapSerperImagesWithStats,
  parseAllowlist,
  qualityScore,
  rankReferences,
  upgradeDribbbleImage,
  upgradePinterestImage,
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

  it("asks cdn.dribbble.com for 1600x1200 and forgets the small size", () => {
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/userupload/1/file/original-a.png?resize=400x300&vertical=center"), 400, 300)).toEqual({
      url: "https://cdn.dribbble.com/userupload/1/file/original-a.png?resize=1600x1200&vertical=center",
    });
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/u/a.png?resize=752x"), 752, 564).width).toBeUndefined();
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/u/a.png?resize=1600x1200"), 1600, 1200)).toEqual({
      url: "https://cdn.dribbble.com/u/a.png?resize=1600x1200",
      width: 1600,
      height: 1200,
    });
    expect(upgradeDribbbleImage(new URL("https://cdn.dribbble.com/u/a.png"), 500, 400).width).toBe(500);
  });

  it("applies upgrades in mapping, keeps the thumb, and drops board pages with 236x images", () => {
    const thumb = "https://encrypted-tbn0.gstatic.com/images?q=1";
    const { references, dropped } = mapSerperImagesWithStats(
      [
        { title: "11 Care Label Design ideas | labels", link: "https://www.pinterest.com/someone/care-labels/", imageUrl: "https://i.pinimg.com/236x/aa/board.jpg", imageWidth: 236, imageHeight: 236, thumbnailUrl: thumb },
        { title: "Woven care label", link: "https://es.pinterest.com/pin/42/", imageUrl: "https://i.pinimg.com/236x/aa/pin.jpg", imageWidth: 236, imageHeight: 300, thumbnailUrl: thumb },
        { title: "Shot", link: "https://dribbble.com/shots/7-x", imageUrl: "https://cdn.dribbble.com/u/7.png?resize=400x300", imageWidth: 400, imageHeight: 300, thumbnailUrl: "https://encrypted-tbn1.gstatic.com/images?q=7" },
        { title: "Tiny", link: "https://dribbble.com/shots/8-x", imageUrl: "https://cdn.dribbble.com/u/8.png", imageWidth: 300, imageHeight: 200 },
        { title: "Gold boarding pass | Zazzle", link: "https://www.pinterest.com/pin/9/", imageUrl: "https://i.pinimg.com/736x/aa/z.jpg", imageWidth: 736, imageHeight: 900 },
      ],
      { sources: ["pinterest", "dribbble"], allowlist, takedowns: EMPTY_TAKEDOWNS, count: 10 },
    );
    expect(dropped).toBe(3);
    const pin = references.find((r) => r.sourceUrl === "https://es.pinterest.com/pin/42/")!;
    expect(pin).toMatchObject({ imageUrl: "https://i.pinimg.com/736x/aa/pin.jpg", thumbUrl: thumb, width: 736, height: 935 });
    const shot = references.find((r) => r.sourceUrl === "https://dribbble.com/shots/7-x")!;
    expect(shot.imageUrl).toBe("https://cdn.dribbble.com/u/7.png?resize=1600x1200");
    expect(shot.thumbUrl).toBe("https://encrypted-tbn1.gstatic.com/images?q=7");
    expect(shot.width).toBeUndefined();
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
    const card = ref({ sourceUrl: "a", title: "Wallet card minimal", width: 1200, height: 900 });
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
