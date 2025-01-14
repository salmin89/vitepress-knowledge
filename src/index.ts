import { parseHTML } from "linkedom";
import type { TransformContext, UserConfig } from "vitepress";
import { join, relative, dirname } from "node:path";
import { relative as relativeNormalized } from "node:path/posix";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { writeFile, mkdir } from "node:fs/promises";
import YAML from "yaml";
import type { TranslatorContext } from "node-html-markdown/dist/translator";

export interface KnowledgeOptions<ThemeConfig> {
  /** Standard Vitepress `extends` to extend another config */
  extends?: UserConfig<ThemeConfig>["extends"];
  /**
   * Break up your paths into multiple knowledge files. This object is a map of base paths to output filenames.
   * @default { "/": "docs" }
   */
  paths: Record<string, string>;
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
    home: ".VPHome",
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
          warnings.push(
            `\x1b[36m${ctx.page}\x1b[0m Selector "${selector}" did not match any elements`,
          );
          return;
        }

        const md = htmlToMd(root.innerHTML);
        if (!md) {
          warnings.push(
            `\x1b[36m${ctx.page}\x1b[0m Empty page, no knowledge extracted`,
          );
          return;
        }

        let pathname =
          "/" +
          relativeNormalized(ctx.siteConfig.outDir, id).replace(
            "index.html",
            "",
          );
        if (ctx.siteConfig.cleanUrls) {
          pathname = pathname.replace(".html", "");
        }
        results.push({
          ...ctx,
          pathname,
          md: htmlToMd(root.innerHTML),
        });
      } catch (err) {
        warnings.push(
          // @ts-expect-error: Unknown error type
          `\x1b[36m${ctx.page}\x1b[0m Failed to parse HTML (${err.message ?? String(err)})`,
        );
      }
    },

    // Write results to knowledge.txt file
    async buildEnd(siteConfig) {
      const knowledgeDir = join(siteConfig.outDir, ".wellknown/knowledge");

      const groups = groupPaths(options?.paths, results);
      for (const [groupName, files] of Object.entries(groups)) {
        await writeKnowledgeFile(knowledgeDir, groupName, files);
      }
      await writeIndexJson(siteConfig.outDir, knowledgeDir, groups);

      if (warnings.length > 0) {
        console.warn(
          `\x1b[93m‼\x1b[0m \x1b[2m[knowledge]\x1b[0m Warnings: ${warnings.length}`,
        );
        warnings.forEach((warning) => {
          console.warn(`  \x1b[2m-\x1b[0m ${warning}`);
        });
      }
    },
  };
}

async function writeIndexJson(
  outDir: string,
  knowledgeDir: string,
  groups: Record<string, KnowledgeContext[]>,
) {
  const file = join(knowledgeDir, "index.json");
  await mkdir(dirname(file), { recursive: true });

  await writeFile(
    file,
    JSON.stringify(
      Object.keys(groups).map(
        (groupName) =>
          "/" +
          relativeNormalized(outDir, getGroupPath(knowledgeDir, groupName)),
      ),
    ),
  );
  printFileWriteSuccess(file);
}

async function writeKnowledgeFile(
  knowledgeDir: string,
  groupName: string,
  files: KnowledgeContext[],
): Promise<void> {
  const file = getGroupPath(knowledgeDir, groupName);
  await mkdir(dirname(file), { recursive: true });

  await writeFile(file, files.map(renderKnowledgeContext).join("\n\n"));
  printFileWriteSuccess(file);
}

/** Convert the data we collected into a string for the knowledge file. */
function renderKnowledgeContext(ctx: KnowledgeContext): string {
  const frontmatter: Record<string, any> = {
    url: ctx.pathname,
  };
  if (ctx.pageData.title !== ctx.siteData.title && ctx.pageData.title) {
    frontmatter.title = ctx.pageData.title;
  }
  if (
    ctx.pageData.description !== ctx.siteData.description &&
    ctx.pageData.description
  ) {
    frontmatter.description = ctx.pageData.description;
  }

  return `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${ctx.md.trim()}`;
}

/** Given a map of base paths to output names and the list of files, group each file under it's output name. */
function groupPaths(
  paths: Record<string, string> | undefined,
  files: KnowledgeContext[],
): Record<string, KnowledgeContext[]> {
  const groups: Record<string, KnowledgeContext[]> = {};

  // Sort base paths by length descending so we match longest/most specific paths first
  const bases = Object.keys(paths ?? {}).sort((a, b) => b.length - a.length);

  for (const file of files) {
    // Find the first base path that matches the start of this file's pathname
    const base = bases.find((base) => file.pathname.startsWith(base)) ?? "/";

    // Get output name for this base path
    const output = paths?.[base ?? ""] ?? "docs";
    groups[output] ??= [];

    // Add file to group
    groups[output].push(file);
  }

  return groups;
}

function getGroupPath(knowledgeDir: string, groupName: string): string {
  return join(knowledgeDir, `${groupName}.txt`);
}

function printFileWriteSuccess(file: string) {
  console.log(
    `\x1b[32m✓\x1b[0m \x1b[2m[knowledge]\x1b[0m generated \x1b[36m${relative(process.cwd(), file)}\x1b[0m`,
  );
}
