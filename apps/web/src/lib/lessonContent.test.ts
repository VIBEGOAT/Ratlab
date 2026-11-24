import { describe, expect, it } from "vitest";
import { LESSON_CONTENT, severityFromGrade } from "./lessonContent";

describe("toxicity lesson content", () => {
  it("covers all five major models with mechanisms, markers and valid checks", () => {
    expect(Object.keys(LESSON_CONTENT)).toEqual(["hepatotoxin", "nephrotoxin", "cardiotoxin", "neurotoxin", "myelotoxin"]);
    for (const lesson of Object.values(LESSON_CONTENT)) {
      expect(lesson.mechanism).toHaveLength(4);
      expect(lesson.markers).toHaveLength(3);
      expect(lesson.options.some((option) => option.key === lesson.correct)).toBe(true);
    }
  });

  it("turns organ grades into student-friendly severity bands", () => {
    expect([0, 1].map(severityFromGrade)).toEqual(["low", "low"]);
    expect([2, 3].map(severityFromGrade)).toEqual(["moderate", "moderate"]);
    expect([4, 5].map(severityFromGrade)).toEqual(["severe", "severe"]);
  });
});
