import { describe, it, expect } from "vitest";
import { getToolsForLevel, PERMISSION_LEVELS } from "../permissions.js";

describe("PERMISSION_LEVELS", () => {
  it("has readonly, standard, and full levels", () => {
    expect(PERMISSION_LEVELS).toContain("readonly");
    expect(PERMISSION_LEVELS).toContain("standard");
    expect(PERMISSION_LEVELS).toContain("full");
  });
});

describe("getToolsForLevel", () => {
  it("readonly allows only read tools", () => {
    const tools = getToolsForLevel("readonly");
    expect(tools).toContain("Read");
    expect(tools).toContain("Glob");
    expect(tools).toContain("Grep");
    expect(tools).not.toContain("Edit");
    expect(tools).not.toContain("Write");
    expect(tools).not.toContain("Bash");
  });

  it("standard allows read + edit tools", () => {
    const tools = getToolsForLevel("standard");
    expect(tools).toContain("Read");
    expect(tools).toContain("Edit");
    expect(tools).toContain("Write");
    expect(tools).toContain("Bash");
    expect(tools).not.toContain("Agent");
  });

  it("full allows all tools", () => {
    const tools = getToolsForLevel("full");
    expect(tools).toContain("Read");
    expect(tools).toContain("Edit");
    expect(tools).toContain("Bash");
    expect(tools).toContain("Agent");
  });

  it("throws on unknown level", () => {
    expect(() => getToolsForLevel("admin")).toThrow("Unknown permission level");
  });

  it("readonly is a subset of standard", () => {
    const ro = getToolsForLevel("readonly");
    const std = getToolsForLevel("standard");
    for (const tool of ro) {
      expect(std).toContain(tool);
    }
  });

  it("standard is a subset of full", () => {
    const std = getToolsForLevel("standard");
    const full = getToolsForLevel("full");
    for (const tool of std) {
      expect(full).toContain(tool);
    }
  });
});
