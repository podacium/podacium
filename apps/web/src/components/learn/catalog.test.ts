import { describe, expect, it } from "vitest";

import {
  formatDuration,
  parseCoursePrice,
  parsePathPrice,
  summarizePathModules,
  type PathModuleLike,
} from "./catalog";
import type { PathResponse } from "@/lib/api/education";

describe("parseCoursePrice", () => {
  it("uses the discounted amount as the price and the original for the strikethrough", () => {
    expect(parseCoursePrice({ original: 5000, discounted: 3000 })).toEqual({
      current: 3000,
      original: 5000,
      isFree: false,
      isDiscounted: true,
    });
  });

  it("falls back to the original amount when there is no discount", () => {
    expect(parseCoursePrice({ original: 5000 })).toEqual({
      current: 5000,
      original: 5000,
      isFree: false,
      isDiscounted: false,
    });
  });

  it("treats a zero discounted amount as free but keeps the original reference", () => {
    expect(parseCoursePrice({ original: 4000, discounted: 0 })).toEqual({
      current: 0,
      original: 4000,
      isFree: true,
      isDiscounted: true,
    });
  });

  it("accepts a plain number as the price", () => {
    expect(parseCoursePrice(2500)).toEqual({
      current: 2500,
      original: 2500,
      isFree: false,
      isDiscounted: false,
    });
  });

  it("degrades to free when the price is missing", () => {
    expect(parseCoursePrice(null)).toEqual({
      current: 0,
      original: 0,
      isFree: true,
      isDiscounted: false,
    });
    expect(parseCoursePrice(undefined)).toEqual({
      current: 0,
      original: 0,
      isFree: true,
      isDiscounted: false,
    });
    expect(parseCoursePrice(0)).toEqual({
      current: 0,
      original: 0,
      isFree: true,
      isDiscounted: false,
    });
  });

  it("never reports a discount when the original is zero", () => {
    const price = parseCoursePrice({ original: 0, discounted: 0 });
    expect(price.isDiscounted).toBe(false);
  });

  it("does not report a discount when the discounted amount is higher", () => {
    const price = parseCoursePrice({ original: 1000, discounted: 2000 });
    expect(price.isDiscounted).toBe(false);
    expect(price.current).toBe(2000);
  });
});

describe("parsePathPrice", () => {
  const basePath = { id: "1", title: "Path" } as PathResponse;

  it("prefers the path's own price", () => {
    const price = parsePathPrice({
      ...basePath,
      price: { original: 9000, discounted: 6000 },
    });
    expect(price).toEqual({
      current: 6000,
      original: 9000,
      isFree: false,
      isDiscounted: true,
    });
  });

  it("uses the original amount when the path has no discount", () => {
    const price = parsePathPrice({ ...basePath, price: { original: 9000 } });
    expect(price).toEqual({
      current: 9000,
      original: 9000,
      isFree: false,
      isDiscounted: false,
    });
  });

  it("returns null when the path is priced at zero", () => {
    const price = parsePathPrice({
      ...basePath,
      price: { original: 9000, discounted: 0 },
    });
    expect(price).toBeNull();
  });

  it("falls back to 80% of the modules' list prices", () => {
    const price = parsePathPrice({
      ...basePath,
      featured_modules: [
        { price: { original: 1000 } },
        { price: { original: 1500 } },
      ],
    });
    expect(price).toEqual({
      current: 2000,
      original: 2000,
      isFree: false,
      isDiscounted: false,
    });
  });

  it("returns null when there is nothing to price", () => {
    expect(parsePathPrice({ ...basePath, featured_modules: [] })).toBeNull();
    expect(parsePathPrice({ ...basePath })).toBeNull();
  });
});

describe("summarizePathModules", () => {
  const modules: PathModuleLike[] = [
    {
      total_lessons: 4,
      duration_minutes: 60,
      rating: 4,
      skills: ["React", "TypeScript"],
      tags: ["Frontend"],
    },
    {
      total_lessons: 6,
      duration_minutes: 90,
      rating: 5,
      skills: ["React", "Testing"],
      tags: ["Frontend", "Quality"],
    },
  ];

  it("sums lessons and minutes", () => {
    const summary = summarizePathModules(modules);
    expect(summary.totalLessons).toBe(10);
    expect(summary.totalMinutes).toBe(150);
  });

  it("averages ratings", () => {
    expect(summarizePathModules(modules).avgRating).toBe(4.5);
  });

  it("de-duplicates skills and tags and caps them at two", () => {
    const summary = summarizePathModules(modules);
    expect(summary.skills).toEqual(["React", "TypeScript"]);
    expect(summary.tags).toEqual(["Frontend", "Quality"]);
  });

  it("handles an empty module list", () => {
    expect(summarizePathModules([])).toEqual({
      totalLessons: 0,
      totalMinutes: 0,
      avgRating: null,
      skills: [],
      tags: [],
    });
    expect(summarizePathModules(undefined).avgRating).toBeNull();
  });

  it("tolerates modules with missing fields", () => {
    const summary = summarizePathModules([{}, { total_lessons: 3 }]);
    expect(summary.totalLessons).toBe(3);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.skills).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("renders hours and minutes", () => {
    expect(formatDuration(190, "h", "min")).toBe("3h 10min");
  });

  it("renders minutes only below an hour", () => {
    expect(formatDuration(45, "h", "min")).toBe("45min");
  });

  it("returns null for empty or invalid input", () => {
    expect(formatDuration(0, "h", "min")).toBeNull();
    expect(formatDuration(null, "h", "min")).toBeNull();
    expect(formatDuration(undefined, "h", "min")).toBeNull();
    expect(formatDuration(-10, "h", "min")).toBeNull();
  });

  it("uses the labels it is given so locales stay free", () => {
    expect(formatDuration(90, "س", "د")).toBe("1س 30د");
  });
});
