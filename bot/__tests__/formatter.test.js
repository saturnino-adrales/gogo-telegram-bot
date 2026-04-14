import { describe, it, expect } from "vitest";
import { mdToTelegramHtml } from "../formatter.js";

describe("mdToTelegramHtml", () => {
  it("converts headers to bold", () => {
    expect(mdToTelegramHtml("# Title")).toBe("<b>Title</b>");
    expect(mdToTelegramHtml("## Subtitle")).toBe("<b>Subtitle</b>");
    expect(mdToTelegramHtml("### Small")).toBe("<b><i>Small</i></b>");
  });

  it("converts bold and italic", () => {
    expect(mdToTelegramHtml("**bold**")).toBe("<b>bold</b>");
    expect(mdToTelegramHtml("*italic*")).toBe("<i>italic</i>");
  });

  it("converts strikethrough", () => {
    expect(mdToTelegramHtml("~~deleted~~")).toBe("<s>deleted</s>");
  });

  it("converts inline code", () => {
    expect(mdToTelegramHtml("`code`")).toBe("<code>code</code>");
  });

  it("converts code blocks", () => {
    const md = "```python\nprint('hi')\n```";
    const html = mdToTelegramHtml(md);
    expect(html).toContain("<pre>");
    expect(html).toContain("print('hi')");
  });

  it("converts blockquotes", () => {
    const html = mdToTelegramHtml("> quoted text");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted text");
  });

  it("converts links", () => {
    const html = mdToTelegramHtml("[click](https://example.com)");
    expect(html).toBe('<a href="https://example.com">click</a>');
  });

  it("converts bullet lists to dots", () => {
    expect(mdToTelegramHtml("- item one")).toBe("• item one");
    expect(mdToTelegramHtml("* item two")).toBe("• item two");
  });

  it("converts horizontal rules", () => {
    expect(mdToTelegramHtml("---")).toBe("────────────────");
  });

  it("converts tables to monospace blocks", () => {
    const md = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    const html = mdToTelegramHtml(md);
    expect(html).toContain("<pre>");
    expect(html).toContain("Alice");
    expect(html).toContain("Name");
  });

  it("escapes HTML entities", () => {
    const html = mdToTelegramHtml("a < b & c > d");
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&gt;");
  });

  it("handles empty input", () => {
    expect(mdToTelegramHtml("")).toBe("");
    expect(mdToTelegramHtml(null)).toBe("");
  });
});
