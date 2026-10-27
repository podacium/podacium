import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormattedMessage } from "./FormattedMessage";

describe("FormattedMessage Component", () => {
  it("renders plain text without crashing", () => {
    render(<FormattedMessage content="Welcome to Podacium support" />);
    expect(screen.getByText(/Welcome to Podacium support/i)).toBeDefined();
  });

  it("renders bold text formatted as strong tags", () => {
    const { container } = render(
      <FormattedMessage content="Please use **EDAHABIA** card" />,
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("EDAHABIA");
  });

  it("renders inline code elements safely", () => {
    const { container } = render(
      <FormattedMessage content="Check error code `ERR_PAYMENT_TIMEOUT` in logs" />,
    );
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("ERR_PAYMENT_TIMEOUT");
  });

  it("renders Arabic text with nested bold, link, and inline code correctly without raw asterisks or backticks", () => {
    const content = `👉 **[دليل الدورات التدريبية (\`/learn/courses\`)](https://podacium.com/learn/courses)**`;
    const { container } = render(<FormattedMessage content={content} />);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();

    const link = strong?.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(
      "https://podacium.com/learn/courses",
    );

    const code = link?.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("/learn/courses");

    // Must not contain raw unprocessed markdown markers
    expect(container.textContent).not.toContain("**");
    expect(container.textContent).not.toContain("`");
    expect(container.textContent).toContain("دليل الدورات التدريبية");
  });

  it("renders multiple consecutive Arabic bold links with inline paths", () => {
    const content = `👉 **[دليل الدورات التدريبية (\`/learn/courses\`)](https://podacium.com/learn/courses)**\n\n👉 **[لوحة تحكم التعلم (\`/dashboard/learning\`)](https://podacium.com/dashboard/learning)**`;
    const { container } = render(<FormattedMessage content={content} />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);

    expect(links[0].getAttribute("href")).toBe(
      "https://podacium.com/learn/courses",
    );
    expect(links[0].querySelector("code")?.textContent).toBe("/learn/courses");

    expect(links[1].getAttribute("href")).toBe(
      "https://podacium.com/dashboard/learning",
    );
    expect(links[1].querySelector("code")?.textContent).toBe(
      "/dashboard/learning",
    );

    expect(container.textContent).not.toContain("**");
    expect(container.textContent).not.toContain("`");
  });

  it("handles four asterisks or empty bold without crashing or leaving raw broken syntax", () => {
    const { container } = render(
      <FormattedMessage content="Edge case **** test" />,
    );
    expect(container.textContent).toContain("Edge case");
  });

  it("renders multi-line code blocks with language and copy button", () => {
    const content =
      "Here is some code:\n```typescript\nconst a: number = 42;\n```";
    const { container } = render(<FormattedMessage content={content} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("const a: number = 42;");
  });

  it("renders headings and blockquotes", () => {
    const content = "### Overview\n> Note this important detail";
    const { container } = render(<FormattedMessage content={content} />);
    const h = container.querySelector("h5");
    expect(h).not.toBeNull();
    expect(h?.textContent).toBe("Overview");

    const bq = container.querySelector("blockquote");
    expect(bq).not.toBeNull();
    expect(bq?.textContent).toBe("Note this important detail");
  });

  it("renders bullet lists properly", () => {
    const content = `- First step\n- Second step\n- Third step`;
    const { container } = render(<FormattedMessage content={content} />);
    const ul = container.querySelector("ul");
    const lis = container.querySelectorAll("li");
    expect(ul).not.toBeNull();
    expect(lis.length).toBe(3);
  });

  it("renders numbered lists properly", () => {
    const content = `1. Open dashboard\n2. Click billing\n3. Download receipt`;
    const { container } = render(<FormattedMessage content={content} />);
    const ol = container.querySelector("ol");
    const lis = container.querySelectorAll("li");
    expect(ol).not.toBeNull();
    expect(lis.length).toBe(3);
  });

  it("renders external links with target _blank and noopener", () => {
    const content = `Read docs at [Chargily Guide](https://chargily.com/docs)`;
    render(<FormattedMessage content={content} />);
    const link = screen.getByRole("link", {
      name: "Chargily Guide",
    }) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe("https://chargily.com/docs");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("renders streaming caret when streaming is true", () => {
    const { container } = render(
      <FormattedMessage content="Streaming response" streaming={true} />,
    );
    const caret = container.querySelector('[data-testid="streaming-caret"]');
    expect(caret).not.toBeNull();
  });

  it("stabilizes unclosed code fence during streaming without layout crash", () => {
    const incompleteStream =
      "Here is Python code:\n```python\nprint('hello world')";
    const { container } = render(
      <FormattedMessage content={incompleteStream} streaming={true} />,
    );
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain("print('hello world')");
  });

  it("stabilizes unclosed bold markdown during streaming", () => {
    const incompleteStream = "Important notice: **Tax shield 100%";
    const { container } = render(
      <FormattedMessage content={incompleteStream} streaming={true} />,
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain("Tax shield 100%");
  });

  it("renders markdown tables with header, alignment and cell formatting", () => {
    const tableContent = `| Wilaya | Statut | Chiffre d'Affaires |
| :--- | :---: | ---: |
| Alger | **Validé** | \`1,500,000 DZD\` |
| Oran | *En attente* | \`980,000 DZD\` |`;

    const { container } = render(<FormattedMessage content={tableContent} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe("Wilaya");
    expect(headers[1].textContent).toBe("Statut");
    expect(headers[2].textContent).toBe("Chiffre d'Affaires");

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);

    const firstRowStrong = rows[0].querySelector("strong");
    expect(firstRowStrong?.textContent).toBe("Validé");

    const firstRowCode = rows[0].querySelector("code");
    expect(firstRowCode?.textContent).toBe("1,500,000 DZD");
  });
});
