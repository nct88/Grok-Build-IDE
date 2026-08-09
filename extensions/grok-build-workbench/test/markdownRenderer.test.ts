/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

interface MarkdownRenderer {
  renderMarkdown(source: string): string;
  setMarkdownContent: (...args: unknown[]) => void;
  setStructuredContent: (...args: unknown[]) => void;
}

function loadMarkdownRenderer(): MarkdownRenderer {
  const sandbox: Record<string, object> = {};
  const source = readFileSync(new URL("../media/markdown.js", import.meta.url), "utf8");
  runInNewContext(source, sandbox);
  return sandbox.GrokMarkdown as MarkdownRenderer;
}

describe("webview Markdown renderer", () => {
  const markdown = loadMarkdownRenderer();

  test("renders readable headings, emphasis, lists, code, quotes, tables, and links", () => {
    const rendered = markdown.renderMarkdown([
      "## Result",
      "",
      "A **clear** result with `inline()` code.",
      "",
      "- First",
      "- Second",
      "",
      "> Important",
      "",
      "```ts",
      "const ok = true;",
      "```",
      "",
      "| Check | State |",
      "| --- | --- |",
      "| Build | Passed |",
      "",
      "[Details](https://example.com/test)",
    ].join("\n"));

    expect(rendered).toContain('<h2 class="md-h">Result</h2>');
    expect(rendered).toContain("<strong>clear</strong>");
    expect(rendered).toContain("<ul class=\"md-list\">");
    expect(rendered).toContain('<pre class="md-code" data-lang="ts">');
    expect(rendered).toContain('<blockquote class="md-quote">Important</blockquote>');
    expect(rendered).toContain('<div class="md-table-wrap"><table>');
    expect(rendered).toContain('href="https://example.com/test"');
    expect(rendered).not.toContain("## Result");
    expect(rendered).not.toContain("**clear**");
  });

  test("exports structured content helper for code cards", () => {
    expect(typeof markdown.setStructuredContent).toBe("function");
    expect(typeof markdown.setMarkdownContent).toBe("function");
  });

  test("escapes agent HTML and rejects non-http links", () => {
    const rendered = markdown.renderMarkdown(
      '<img src=x onerror=alert(1)> [unsafe](javascript:alert(1)) [safe](https://example.com/?a=1&b=2)',
    );

    expect(rendered).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(rendered).toContain("[unsafe](javascript:alert(1))");
    expect(rendered).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(rendered).not.toContain("<img");
    expect(rendered).not.toContain('href="javascript:');
  });
});
