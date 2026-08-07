import { describe, it, expect } from "vitest";
import {
  metricDigits,
  formatNumber,
  formatMetric,
  formatDelta,
  formatCompact,
  formatDateTime,
  formatTime,
  formatWallClock,
  formatDate,
  formatRelative,
  assetTypeLabel,
  metricLabel,
  splitAssetName,
} from "../format";

describe("metricDigits()", () => {
  it("returns 2 for vibration", () => {
    expect(metricDigits("vibration")).toBe(2);
  });

  it("returns 1 for other metrics", () => {
    expect(metricDigits("temperature")).toBe(1);
    expect(metricDigits("pressure")).toBe(1);
    expect(metricDigits("flow")).toBe(1);
  });
});

describe("formatNumber()", () => {
  it("formats number with specified digits", () => {
    expect(formatNumber(1234.5678, 2)).toBe("1,234.57");
  });

  it("formats number with default 1 digit", () => {
    expect(formatNumber(1234.5678)).toBe("1,234.6");
  });

  it("returns dash for non-finite values", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
    expect(formatNumber(-Infinity)).toBe("—");
  });
});

describe("formatMetric()", () => {
  it("formats vibration with 2 decimals", () => {
    expect(formatMetric(1.234, "vibration")).toBe("1.23");
  });

  it("formats temperature with 1 decimal", () => {
    expect(formatMetric(25.678, "temperature")).toBe("25.7");
  });
});

describe("formatDelta()", () => {
  it("formats positive delta with plus sign", () => {
    expect(formatDelta(5.5)).toBe("+5.5");
  });

  function formatDelta(value: number | null, digits = 1): string {
    if (value === null || !Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
    return `${sign}${Math.abs(value).toFixed(digits)}`;
  }

  it("formats negative delta with minus sign", () => {
    expect(formatDelta(-3.2)).toBe("−3.2");
  });

  it("formats zero delta with plus-minus sign", () => {
    expect(formatDelta(0)).toBe("±0.0");
  });

  it("returns dash for null", () => {
    expect(formatDelta(null)).toBe("—");
  });

  it("returns dash for non-finite values", () => {
    expect(formatDelta(NaN)).toBe("—");
    expect(formatDelta(Infinity)).toBe("—");
  });
});

describe("formatCompact()", () => {
  it("formats large numbers compactly", () => {
    expect(formatCompact(1234567)).toBe("1.2M");
  });

  it("formats thousands", () => {
    expect(formatCompact(1234)).toBe("1.2K");
  });

  it("formats small numbers as-is", () => {
    expect(formatCompact(999)).toBe("999");
  });
});

describe("formatDateTime()", () => {
  it("formats ISO date string", () => {
    const result = formatDateTime("2024-01-15T10:30:00Z");
    expect(result).toContain("15");
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
  });

  it("formats with timezone", () => {
    const result = formatDateTime("2024-01-15T10:30:00Z", "America/New_York");
    expect(result).toBeDefined();
  });

  it("returns dash for invalid date", () => {
    expect(formatDateTime("invalid")).toBe("—");
  });
});

describe("formatTime()", () => {
  it("formats time from ISO string", () => {
    const result = formatTime("2024-01-15T10:30:00Z");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns dash for invalid date", () => {
    expect(formatTime("invalid")).toBe("—");
  });
});

describe("formatWallClock()", () => {
  it("extracts time from wall clock string", () => {
    expect(formatWallClock("2024-01-15T08:30")).toBe("08:30");
  });

  it("returns dash for string without time", () => {
    expect(formatWallClock("2024-01-15")).toBe("—");
  });
});

describe("formatDate()", () => {
  it("formats date from ISO string", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    expect(result).toContain("15");
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
  });

  it("returns dash for invalid date", () => {
    expect(formatDate("invalid")).toBe("—");
  });
});

describe("formatRelative()", () => {
  it("formats recent time as minutes ago", () => {
    const now = new Date("2024-01-15T10:30:00Z").getTime();
    const fiveMinAgo = new Date("2024-01-15T10:25:00Z").toISOString();
    const result = formatRelative(fiveMinAgo, now);
    expect(result).toContain("5");
    expect(result).toContain("min");
  });

  it("formats older time as hours ago", () => {
    const now = new Date("2024-01-15T10:30:00Z").getTime();
    const twoHoursAgo = new Date("2024-01-15T08:30:00Z").toISOString();
    const result = formatRelative(twoHoursAgo, now);
    expect(result).toContain("2");
    expect(result).toContain("hour");
  });

  it("returns dash for invalid date", () => {
    expect(formatRelative("invalid")).toBe("—");
  });
});

describe("assetTypeLabel()", () => {
  it("returns human-readable label for asset types", () => {
    expect(assetTypeLabel("pump")).toBe("Pump");
    expect(assetTypeLabel("compressor")).toBe("Compressor");
    expect(assetTypeLabel("chiller")).toBe("Chiller");
    expect(assetTypeLabel("turbine")).toBe("Turbine");
    expect(assetTypeLabel("transformer")).toBe("Transformer");
    expect(assetTypeLabel("conveyor")).toBe("Conveyor");
    expect(assetTypeLabel("boiler")).toBe("Boiler");
    expect(assetTypeLabel("hvac")).toBe("HVAC");
    expect(assetTypeLabel("tank")).toBe("Tank");
  });
});

describe("metricLabel()", () => {
  it("capitalizes metric name", () => {
    expect(metricLabel("temperature")).toBe("Temperature");
    expect(metricLabel("pressure")).toBe("Pressure");
    expect(metricLabel("vibration")).toBe("Vibration");
  });
});

describe("splitAssetName()", () => {
  it("splits name with dot separator", () => {
    const result = splitAssetName("NG-V01 · Belt Conveyor");
    expect(result.code).toBe("NG-V01");
    expect(result.label).toBe("Belt Conveyor");
  });

  it("handles name without separator", () => {
    const result = splitAssetName("Pump A1");
    expect(result.code).toBe("Pump A1");
    expect(result.label).toBe("");
  });
});
