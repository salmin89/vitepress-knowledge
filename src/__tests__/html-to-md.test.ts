import { describe, it, expect } from "bun:test";
import { createHtmlToMdConverter } from "../html-to-md";

describe("HTML to Markdown Converter", () => {
  describe("Code blocks", () => {
    it("should convert code blocks without a language tag", () => {
      const htmlToMd = createHtmlToMdConverter();
      const input = `
        <div class="language-sh vp-adaptive-theme active">
          <pre class="shiki shiki-themes github-light github-dark vp-code"><code>wxt/{{version}}</code></pre>
        </div>
      `;
      const expected = `\`\`\`
wxt/{{version}}
\`\`\``;

      const actual = htmlToMd(input);

      expect(actual).toBe(expected);
    });

    it("should convert code blocks with a language tag", () => {
      const htmlToMd = createHtmlToMdConverter();
      const input = `
        <div class="language-html vp-adaptive-theme">
          <button title="Copy Code" class="copy"></button>
          <span class="lang">html</span>
          <pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code>📂 {rootDir}</code></pre>
        </div>
      `;
      const expected = `\`\`\`html
📂 {rootDir}
\`\`\``;

      const actual = htmlToMd(input);

      expect(actual).toBe(expected);
    });
  });

  describe("Custom blocks", () => {
    it.each(["info", "tip", "warning", "danger"])(
      "should convert %s blocks without titles",
      (type) => {
        const htmlToMd = createHtmlToMdConverter();
        const input = `
          <div class="${type} custom-block">
            <p class="custom-block-title">${type.toUpperCase()}</p>
            <p>paragraph 1</p>
            <p>paragraph 2</p>
          </div>
        `;
        const expected = `:::${type}
paragraph 1

paragraph 2
:::`;

        const actual = htmlToMd(input);

        expect(actual).toBe(expected);
      },
    );

    it.each(["info", "tip", "warning", "danger"])(
      "should convert %s blocks with titles",
      (type) => {
        const htmlToMd = createHtmlToMdConverter();
        const input = `
          <div class="${type} custom-block">
            <p class="custom-block-title">Some Title</p>
            <p>paragraph 1</p>
            <p>paragraph 2</p>
          </div>
        `;
        const expected = `:::${type} Some Title
paragraph 1

paragraph 2
:::`;

        const actual = htmlToMd(input);

        expect(actual).toBe(expected);
      },
    );

    it("should convert detail blocks without titles", () => {
      const htmlToMd = createHtmlToMdConverter();
      const input = `
        <details class="details custom-block"><summary>DETAILS</summary><p>paragraph 1</p><p>paragraph 2</p></details>
      `;
      const expected = `:::details
paragraph 1

paragraph 2
:::`;

      const actual = htmlToMd(input);

      expect(actual).toBe(expected);
    });

    it("should convert detail blocks with titles", () => {
      const htmlToMd = createHtmlToMdConverter();
      const input = `
        <details class="details custom-block"><summary>Some Title</summary><p>paragraph 1</p><p>paragraph 2</p></details>
      `;
      const expected = `:::details Some Title
paragraph 1

paragraph 2
:::`;

      const actual = htmlToMd(input);

      expect(actual).toBe(expected);
    });
  });

  describe.todo("Code Groups");
});
