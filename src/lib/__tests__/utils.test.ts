import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn()", () => {
  it("merges class names", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles conditional classes", () => {
    const result = cn("base", true && "active", false && "inactive");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("inactive");
  });

  it("resolves Tailwind conflicts", () => {
    const result = cn("px-4", "px-8");
    expect(result).toBe("px-8");
  });

  it("handles undefined and null", () => {
    const result = cn("base", undefined, null);
    expect(result).toBe("base");
  });

  it("handles empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("handles array inputs", () => {
    const result = cn(["text-red", "text-blue"]);
    expect(result).toContain("text-blue");
  });

  it("handles object inputs", () => {
    const result = cn({ "text-red": true, "text-blue": false });
    expect(result).toContain("text-red");
    expect(result).not.toContain("text-blue");
  });
});
