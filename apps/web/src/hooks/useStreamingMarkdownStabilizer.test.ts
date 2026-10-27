import { describe, it, expect } from "vitest";
import { stabilizeStreamingMarkdown } from "./useStreamingMarkdownStabilizer";

describe("stabilizeStreamingMarkdown", () => {
  it("synthesizes closing code fences when odd fences exist", () => {
    const input = "Here is some code:\n```typescript\nconst x = 10;";
    const output = stabilizeStreamingMarkdown(input, true);
    expect(output).toBe(
      "Here is some code:\n```typescript\nconst x = 10;\n```",
    );
  });

  it("leaves balanced code blocks unmodified", () => {
    const input = "Here is code:\n```typescript\nconst x = 10;\n```";
    const output = stabilizeStreamingMarkdown(input, true);
    expect(output).toBe(input);
  });

  it("balances dangling bold asterisks during streaming", () => {
    const input = "This is **critical info in Darija";
    const output = stabilizeStreamingMarkdown(input, true);
    expect(output).toBe("This is **critical info in Darija**");
  });

  it("bypasses stabilization when isStreaming is false", () => {
    const input = "Incomplete `code";
    const output = stabilizeStreamingMarkdown(input, false);
    expect(output).toBe(input);
  });

  it("does not let backticks inside closed code fences corrupt inline code parity", () => {
    // Code fence contains backtick templates, followed by dangling inline code outside
    const input =
      "```javascript\nconst str = `val: ${x}`;\n```\nHere is an incomplete `inlineCode";
    const output = stabilizeStreamingMarkdown(input, true);
    expect(output).toBe(
      "```javascript\nconst str = `val: ${x}`;\n```\nHere is an incomplete `inlineCode`",
    );
  });

  it("does not balance inline code if inline code is already balanced outside closed fences", () => {
    const input =
      "```javascript\nconst str = `val`;\n```\nHere is complete `code`";
    const output = stabilizeStreamingMarkdown(input, true);
    expect(output).toBe(input);
  });

  it("does not let double asterisks inside code blocks trigger false bold balancing", () => {
    const input = "```python\nval = 2 ** 8\n```\nHere is normal text";
    const output = stabilizeStreamingMarkdown(input, true);
    expect(output).toBe(input);
  });
});
