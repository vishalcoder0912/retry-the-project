import { describe, expect, it } from "vitest";
import { localCommand } from "@/features/chat/components/ChatInterface";

const rows = [
  { country: "India", salary_usd: 50000, experience: 2 },
  { country: "USA", salary_usd: 90000, experience: 5 },
  { country: "India", salary_usd: 65000, experience: 3 },
  { country: "Canada", salary_usd: 120000, experience: 8 },
];

describe("ChatInterface local command options", () => {
  it("turns a bare numeric threshold into a useful metric answer", () => {
    const command = localCommand("75000", rows);

    expect(command).toMatchObject({
      action: "ANSWER",
      schemaOnly: true,
    });
    expect(command?.message).toContain("2 rows");
    expect(command?.message).toContain("Salary Usd");
    expect(command?.message).toContain("75,000");
  });

  it("maps generic chart options to a schema-aware chart", () => {
    const command = localCommand("Generate Chart", rows);

    expect(command).toMatchObject({
      action: "GENERATE_CHART",
      chartSpec: {
        type: "bar",
        xKey: "country",
        yKey: "salary_usd",
        aggregation: "avg",
      },
    });
  });

  it("answers data quality option prompts locally", () => {
    const command = localCommand("Explain data quality", rows);

    expect(command).toMatchObject({
      action: "ANSWER",
      schemaOnly: true,
    });
    expect(command?.message).toContain("Data quality");
    expect(command?.message).toContain("Completeness");
  });
});
