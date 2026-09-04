import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

/**
 * The renderer's whole reason for being hand-written is that it escapes
 * before it formats. A model answer is untrusted text on its way to
 * `innerHTML`, so these are the tests that matter most here.
 */
describe("escaping", () => {
    it("neutralises markup in model output", () => {
        const html = renderMarkdown("<script>alert(1)</script>");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("escapes inside code blocks too", () => {
        const html = renderMarkdown("```\n<img onerror=x>\n```");
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img");
    });

    it("escapes inside inline code", () => {
        const html = renderMarkdown("use `<b>bold</b>` here");
        expect(html).not.toContain("<b>");
        expect(html).toContain("&lt;b&gt;");
    });

    it("does not let an attribute break out of a link", () => {
        const html = renderMarkdown('[x](https://a.com" onmouseover="alert(1))');
        expect(html).not.toContain('onmouseover="alert');
    });

    it("escapes quotes, which is what closes an attribute", () => {
        expect(renderMarkdown('say "hi"')).toContain("&quot;");
    });
});

describe("formatting", () => {
    it("renders bold and italic", () => {
        expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
        expect(renderMarkdown("*italic*")).toContain("<em>italic</em>");
    });

    it("prefers bold over italic so ** is not eaten by the single-* rule", () => {
        const html = renderMarkdown("**both**");
        expect(html).toContain("<strong>both</strong>");
        expect(html).not.toContain("<em>");
    });

    /**
     * The model writes arithmetic far more often than it writes emphasis
     * around spaces, and turning `2 * 3 * 4` into italics silently corrupts
     * an answer rather than merely styling it oddly.
     */
    it("leaves arithmetic alone", () => {
        const html = renderMarkdown("2 * 3 * 4 = 24");
        expect(html).not.toContain("<em>");
        expect(html).toContain("2 * 3 * 4 = 24");
    });

    it("renders code blocks", () => {
        const html = renderMarkdown("```rust\nlet x = 1;\n```");
        expect(html).toContain("let x = 1;");
        expect(html).toContain("<pre");
    });

    it("renders both kinds of list", () => {
        expect(renderMarkdown("- a\n- b")).toContain("<ul>");
        expect(renderMarkdown("1. a\n2. b")).toContain("<ol>");
    });

    it("renders headings", () => {
        expect(renderMarkdown("# Title")).toMatch(/<h1[^>]*>Title<\/h1>/);
    });

    it("keeps paragraphs separate", () => {
        const html = renderMarkdown("first\n\nsecond");
        expect(html.match(/<p>/g)?.length).toBe(2);
    });
});

describe("input it should survive", () => {
    it("handles empty and whitespace-only source", () => {
        expect(() => renderMarkdown("")).not.toThrow();
        expect(() => renderMarkdown("   \n\n  ")).not.toThrow();
    });

    /** Streaming means the renderer sees every prefix of the answer. */
    it("handles a code fence that has not closed yet", () => {
        expect(() => renderMarkdown("```rust\nlet x =")).not.toThrow();
    });

    it("handles an unterminated emphasis marker", () => {
        expect(() => renderMarkdown("**not closed")).not.toThrow();
        expect(renderMarkdown("**not closed")).toContain("not closed");
    });

    it("passes unrecognised syntax through as text", () => {
        expect(renderMarkdown("~~strike~~")).toContain("strike");
    });
});
