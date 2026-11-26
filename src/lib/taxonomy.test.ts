import { describe, expect, it } from "vitest";
import { areaBySlug, formatYears, typeBySlug, yearLabel, YEARS, LEARNING_AREAS, RESOURCE_TYPES } from "./taxonomy";

describe("taxonomy", () => {
  it("covers New Entrant to Year 13", () => {
    expect(YEARS[0]).toBe(0);
    expect(YEARS.at(-1)).toBe(13);
  });
  it("labels years", () => {
    expect(yearLabel(0)).toBe("New Entrant");
    expect(yearLabel(0, true)).toBe("NE");
    expect(yearLabel(7)).toBe("Year 7");
    expect(yearLabel(7, true)).toBe("Y7");
  });
  it.each([
    [[], "All years"],
    [[4], "Year 4"],
    [[0], "New Entrant"],
    [[3, 4, 5], "Years 3–5"],
    [[0, 1, 2, 5, 7, 8], "Years NE–2, 5, 7–8"],
    [[5, 3, 4, 4], "Years 3–5"],
  ])("formats %j as %s", (years, out) => {
    expect(formatYears(years as number[])).toBe(out);
  });
  it("looks up areas and types", () => {
    expect(areaBySlug("maths")?.name).toBe("Maths & Statistics");
    expect(areaBySlug("nope")).toBeUndefined();
    expect(typeBySlug("worksheet")?.name).toBe("Worksheet");
    expect(new Set(LEARNING_AREAS.map((a) => a.slug)).size).toBe(LEARNING_AREAS.length);
    expect(new Set(RESOURCE_TYPES.map((a) => a.slug)).size).toBe(RESOURCE_TYPES.length);
  });
});
