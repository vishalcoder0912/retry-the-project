import { describe, expect, it } from "vitest";
import { buildSchemaProfile, makeSchemaOnlyPacket } from "../services/ai-analyst/schema-fingerprint.js";
import { salaryDataset } from "./test-helpers.js";

describe("schema fingerprint", () => {
  it("detects schema roles and excludes raw rows from schema-only packet", () => {
    const profile = buildSchemaProfile(salaryDataset);
    const packet = makeSchemaOnlyPacket(profile);
    const country = profile.columns.find((column) => column.name === "country");
    const salary = profile.columns.find((column) => column.name === "salary_usd");
    const experience = profile.columns.find((column) => column.name === "experience");

    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(3);
    expect(["location", "category"]).toContain(country.role);
    expect(salary.role).toBe("money_metric");
    expect(["continuous_metric", "count_metric"]).toContain(experience.role);
    expect(JSON.stringify(packet)).not.toContain("\"rows\"");
    expect(JSON.stringify(packet)).not.toContain("50000");
  });
});
