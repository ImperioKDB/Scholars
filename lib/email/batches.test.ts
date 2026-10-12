import { describe, expect, it } from "vitest";
import { selectEmailBatch } from "./batches";

describe("selectEmailBatch", () => {
  const students = Array.from({ length: 905 }, (_, index) => index + 1);

  it("selects three non-overlapping 300-student windows", () => {
    expect(selectEmailBatch(students, "A")).toEqual(students.slice(0, 300));
    expect(selectEmailBatch(students, "B")).toEqual(students.slice(300, 600));
    expect(selectEmailBatch(students, "C")).toEqual(students.slice(600, 900));
  });

  it("leaves the final batch short when fewer than 300 students remain", () => {
    expect(selectEmailBatch(students, "C")).toHaveLength(300);
    expect(selectEmailBatch(students.slice(0, 602), "C")).toEqual([601, 602]);
  });
});
