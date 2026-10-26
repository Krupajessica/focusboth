import { describe, expect, it } from "vitest";
import parity from "./title-parity.json";
import { predictSoc } from "../lib/title-model";

describe("TypeScript title model matches Python (analytics/export_title_model.py)", () => {
  const cases = parity as Array<{ title: string; soc: string }>;
  it(`agrees on ${cases.length} held-out titles`, () => {
    const mismatches = cases.filter((c) => predictSoc(c.title, 1)[0].soc !== c.soc);
    expect(mismatches).toEqual([]);
  });
  it("returns probabilities that sum to at most 1 and are sorted", () => {
    const top = predictSoc("Senior Data Scientist", 3);
    expect(top).toHaveLength(3);
    expect(top[0].probability).toBeGreaterThanOrEqual(top[1].probability);
    expect(top.reduce((a, b) => a + b.probability, 0)).toBeLessThanOrEqual(1.0000001);
  });
});
