/**
 * Junk the field agent rated bad on 2026-10-12 (search_feedback rows of the flight checkout board),
 * by title, and what must still pass.
 */
import { describe, expect, it } from "vitest";
import { isArtJunk, isKitTitle } from "@/lib/sources/quality";

describe("art zone junk gate: classroom and kids' learning material, asset packs", () => {
  it("drops the classroom and maths results of 'giant plus sign poster'", () => {
    for (const title of [
      "Math Giants! This elementary math measurement lesson creates giant posters for your room or hallway",
      "I made this giant calculator for my classroom to help me model and to help the kids",
      "Times tables anchor chart for 3rd grade",
      "Plus and minus signs worksheet for kindergarten",
      "Teacher bulletin board ideas",
      "DIY Record Sleeve Bunting",
    ]) {
      expect(isArtJunk(title, "giant plus sign poster"), title).toBe(true);
    }
  });

  it("drops asset packs and mockups sold as files", () => {
    expect(isArtJunk("Record Cover Mockup Pack :: Behance", "vinyl record sleeve")).toBe(true);
    expect(isArtJunk("Dry Ink Textures - Vector & PNG :: Behance", "letterpress texture")).toBe(true);
  });

  it("keeps posters and a classroom word the art query itself names", () => {
    expect(isArtJunk("Pedestal - Obey Giant Poster Design", "giant plus sign poster")).toBe(false);
    expect(isArtJunk("Poster Design / Illo for SF NYE Event :: Behance", "giant plus sign poster")).toBe(false);
    expect(isArtJunk("Vintage classroom chalkboard lettering", "vintage classroom chalkboard")).toBe(false);
    expect(isArtJunk("Swiss style math poster", "swiss math poster")).toBe(false);
  });
});

describe("UI zone kit filter: Figma Community kits and free files", () => {
  it("drops the Figma results the agent rated stock_or_shop", () => {
    for (const title of [
      "Flight Ticket Booking App UI-Kit | Figma",
      "Flights • Free App UI-Kit | Figma",
      "Airplane (Flight) App Free | Figma",
      "Travel UIKit",
      "Banking Design System Kit",
      "Free UI resources for travel apps",
      "Freebies: flight app screens",
    ]) {
      expect(isKitTitle(title), title).toBe(true);
    }
  });

  it("keeps designed screens", () => {
    for (const title of [
      "Flight booking concept - checkout page by Gosia Sobczyk on Dribbble",
      "Hands-free driving app concept",
      "Distraction-free UI for a reading app",
      "Clutter-free app home screen",
      "Travel Mobile App - Flight Checkout by Yoga Satria",
    ]) {
      expect(isKitTitle(title), title).toBe(false);
    }
  });
});
