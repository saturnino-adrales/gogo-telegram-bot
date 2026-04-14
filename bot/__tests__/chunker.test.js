import { describe, it, expect } from "vitest";
import { chunkMessage } from "../chunker.js";

describe("chunkMessage", () => {
  it("returns single chunk for short messages", () => {
    const chunks = chunkMessage("Hello world");
    expect(chunks).toEqual(["Hello world"]);
  });

  it("returns single chunk for exactly 4096 chars", () => {
    const msg = "a".repeat(4096);
    const chunks = chunkMessage(msg);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(4096);
  });

  it("splits at paragraph boundary when possible", () => {
    const para1 = "a".repeat(3000);
    const para2 = "b".repeat(3000);
    const msg = `${para1}\n\n${para2}`;
    const chunks = chunkMessage(msg);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(para1);
    expect(chunks[1]).toBe(para2);
  });

  it("splits at newline if no paragraph boundary", () => {
    const line1 = "a".repeat(3000);
    const line2 = "b".repeat(3000);
    const msg = `${line1}\n${line2}`;
    const chunks = chunkMessage(msg);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(line1);
    expect(chunks[1]).toBe(line2);
  });

  it("hard splits at 4096 if no newline found", () => {
    const msg = "a".repeat(8192);
    const chunks = chunkMessage(msg);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(4096);
    expect(chunks[1]).toHaveLength(4096);
  });

  it("does not split inside code blocks", () => {
    const before = "a".repeat(2000);
    const codeBlock = "```\n" + "x".repeat(2000) + "\n```";
    const after = "b".repeat(2000);
    const msg = `${before}\n\n${codeBlock}\n\n${after}`;
    const chunks = chunkMessage(msg);
    for (const chunk of chunks) {
      const opens = (chunk.match(/```/g) || []).length;
      expect(opens % 2).toBe(0);
    }
  });

  it("returns empty array for empty string", () => {
    const chunks = chunkMessage("");
    expect(chunks).toEqual([]);
  });

  it("every chunk is <= 4096 chars", () => {
    const msg = "word ".repeat(2000);
    const chunks = chunkMessage(msg);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });
});
