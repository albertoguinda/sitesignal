import { describe, it, expect } from "vitest";
import { formatNumber, formatCompact, formatRelative } from "../format";

describe("formatNumber", () => {
  it("should format integer", () => {
    expect(formatNumber(1234)).toBe("1,234.0");
  });

  it("should format with decimals", () => {
    expect(formatNumber(1234.5678, 2)).toBe("1,234.57");
  });

  it("should handle zero", () => {
    expect(formatNumber(0)).toBe("0.0");
  });

  it("should handle negative numbers", () => {
    expect(formatNumber(-1234.5, 1)).toBe("-1,234.5");
  });
});

describe("formatCompact", () => {
  it("should format thousands with K suffix", () => {
    expect(formatCompact(1234)).toBe("1.2K");
  });

  it("should format millions with M suffix", () => {
    expect(formatCompact(1234567)).toBe("1.2M");
  });

  it("should format small numbers as is", () => {
    expect(formatCompact(999)).toBe("999");
  });

  it("should handle zero", () => {
    expect(formatCompact(0)).toBe("0");
  });
});

describe("formatRelative", () => {
  it("should format seconds ago", () => {
    const date = new Date(Date.now() - 5000).toISOString();
    expect(formatRelative(date)).toMatch(/seconds? ago/);
  });

  it("should format minutes ago", () => {
    const date = new Date(Date.now() - 120000).toISOString();
    expect(formatRelative(date)).toMatch(/minutes? ago/);
  });

  it("should format hours ago", () => {
    const date = new Date(Date.now() - 3600000).toISOString();
    expect(formatRelative(date)).toMatch(/hours? ago/);
  });

  it("should handle invalid date", () => {
    expect(formatRelative("invalid")).toBe("—");
  });
});
