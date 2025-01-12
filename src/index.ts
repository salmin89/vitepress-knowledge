import { parseHTML } from "linkedom";
import type { TransformContext, UserConfig } from "vitepress";
import { join, relative } from "node:path";
import { relative as relativeNormalized } from "node:path/posix";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { writeFile } from "node:fs/promises";
import YAML from "yaml";
import type { TranslatorContext } from "node-html-markdown/dist/translator";

export interface KnowledgeOptions<ThemeConfig> {
  /** Standard Vitepress `extends` to extend another config */
  extends?: UserConfig<ThemeConfig>["extends"];
  /** Default selector to only process content from inside. */
  selector?: string;
  /** Customize the selector used for each page layout. */
  layoutSelectors?: Record<string, string>;
  /** Customize the selector for individual pages. */
  pageSelectors?: Record<string, string>;
}

export type KnowledgeContext = TransformContext & {
  md: string;
  pathname: string;
};

export default function knowledge<ThemeConfig>(
  options?: KnowledgeOptions<ThemeConfig>,
): UserConfig<ThemeConfig>["extends"] {
  const postprocessCustomBlock = (
    ctx: TranslatorContext & { content: string },
  ): string | undefined => {
    if (!ctx.node.classList.contains("custom-block")) return undefined;

    const type =
      ["info", "tip", "warning", "danger", "details"].find((type) =>
        ctx.node.classList.contains(type),
      ) ?? "unknown";

    // @ts-expect-error: Not checking node type
    const title = htmlToMd(ctx.node.firstChild!.innerHTML ?? type);

    const children: string[] = [];
    ctx.node.childNodes.forEach((child, i) => {
      if (i === 0) return;
      // @ts-expect-error: Not checking node type
      children.push(child.outerHTML);
    });
    const content = htmlToMd(children.join("\n"));

    const isCustomTitle = title.toLowerCase() !== type.toLowerCase();

    if (isCustomTitle) return `:::${type} ${title}\n${content}\n:::`;
    return `:::${type}\n${content}\n:::`;
  };

  const postprocessShikiCodeBlock = (
    ctx: TranslatorContext & { content: string },
  ): string | undefined => {
    if (!ctx.node.classList.toString().includes("language-")) return undefined;

    const lang = ctx.node.childNodes[1].textContent;
    // @ts-expect-error: Not checking node type
    const content = htmlToMd(ctx.node.lastChild!.outerHTML);

    return content.replace("```\n", `\`\`\`${lang}\n`);
  };

  const postprocessCodeGroup = (
    ctx: TranslatorContext & { content: string },
  ): string | undefined => {
    if (!ctx.node.classList.contains("vp-code-group")) return undefined;

    const tabs = ctx.node.firstChild!;
    const blocks = ctx.node.lastChild!;

    const titles: string[] = [];
    tabs.childNodes.forEach((child) => {
      // @ts-expect-error: Not checking node type
      const text = htmlToMd(child.outerHTML);
      if (text) titles.push(text);
    });

    const codeBlocks: string[] = [];
    blocks.childNodes.forEach((child) => {
      // @ts-expect-error: Not checking node type
      codeBlocks.push(htmlToMd(child.outerHTML));
    });

    return codeBlocks
      .map((block, i) => {
        if (titles[i]) return `${titles[i]}:\n${block}\n`;
        return block + "\n";
      })
      .join("\n");
  };

  const nhm = new NodeHtmlMarkdown(
    {},
    {
      div: {
        postprocess(ctx) {
          const customBlock = postprocessCustomBlock(ctx);
          if (customBlock) return customBlock;

          const codeBlock = postprocessShikiCodeBlock(ctx);
          if (codeBlock) return codeBlock;

          const codeGroup = postprocessCodeGroup(ctx);
          if (codeGroup) return codeGroup;

          return ctx.content;
        },
      },
      details: {
        postprocess(ctx) {
          const customBlock = postprocessCustomBlock(ctx);
          if (customBlock) return customBlock;

          return ctx.content;
        },
      },
    },
  );
  const htmlToMd = nhm.translate.bind(nhm);
  const results: KnowledgeContext[] = [];
  const warnings: string[] = [];

  const DEFAULT_LAYOUT_SELECTORS: Record<string, string> = {
    undefined: "main",
    home: "body",
  };

  return {
    // Allow extending another theme/config
    extends: options?.extends,

    // Get HTML page contents as markdown
    transformHtml(code, id, ctx) {
      try {
        const { document } = parseHTML(code);

        const selector =
          options?.pageSelectors?.[ctx.page] ??
          options?.layoutSelectors?.[ctx.pageData.frontmatter.layout] ??
          options?.selector ??
          DEFAULT_LAYOUT_SELECTORS[
            ctx.pageData.frontmatter.layout ?? "undefined"
          ];
        const root = document.querySelector(selector);
        if (!root) {
          warnings.push(`Root element (${selector}) not found on: ${ctx.page}`);
          return;
        }

        const md = htmlToMd(root.innerHTML);
        if (!md) {
          warnings.push("Empty page:" + ctx.page);
          return;
        }

        results.push({
          ...ctx,
          pathname: "/" + relativeNormalized(ctx.siteConfig.outDir, id),
          md: htmlToMd(root.innerHTML),
        });
      } catch (err) {
        warnings.push(
          // @ts-expect-error: Unknown error type
          `Failed to parse ${ctx.page}'s' HTML: ${err.message ?? String(err)}`,
        );
      }
    },

    // Write results to knowledge.txt file
    async buildEnd(siteConfig) {
      const outputPath = join(siteConfig.outDir, "knowledge.txt");
      await writeFile(
        outputPath,
        results.map(renderKnowledgeContext).join("\n\n"),
      );
      console.log(
        `\x1b[32m✓\x1b[0m generated \x1b[36m${relative(process.cwd(), outputPath)}\x1b[0m`,
      );
      warnings.forEach((warning) => {
        console.warn(`  - ${warning}`);
      });
    },
  };
}

/** Convert the data we collected into a string for the knowledge file. */
function renderKnowledgeContext(ctx: KnowledgeContext): string {
  const frontmatter: Record<string, any> = {
    url: ctx.pathname,
  };
  if (ctx.pageData.title !== ctx.siteData.title) {
    frontmatter.title = ctx.pageData.title;
  }
  if (ctx.pageData.description !== ctx.siteData.description) {
    frontmatter.description = ctx.pageData.description;
  }
  return `\`\`\`\`\`\`
---
${YAML.stringify(frontmatter).trim()}
---

${ctx.md.trim()}
\`\`\`\`\`\``;
}
