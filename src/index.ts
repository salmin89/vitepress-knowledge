import { Window } from "happy-dom";
import type { TransformContext, UserConfig } from "vitepress";
import { join } from "node:path";
import { relative as relativeNormalized } from "node:path/posix";
import { writeIndexJson, writeKnowledgeFile } from "./rendering";
import { createHtmlToMdConverter } from "./html-to-md";
import pc from "picocolors";

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
  const htmlToMd = createHtmlToMdConverter();
  const results: KnowledgeContext[] = [];
  const warnings: any[][] = [];

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
        const { document } = new Window();
        document.documentElement.innerHTML = code;

        const selector =
          options?.pageSelectors?.[ctx.page] ??
          options?.layoutSelectors?.[ctx.pageData.frontmatter.layout] ??
          options?.selector ??
          DEFAULT_LAYOUT_SELECTORS[
            ctx.pageData.frontmatter.layout ?? "undefined"
          ];
        const root = document.querySelector(selector);
        if (!root) {
          warnings.push([
            pc.cyan(ctx.page),
            `Selector "${selector}" did not match any elements`,
          ]);
          return;
        }

        const md = htmlToMd(root.innerHTML);
        if (!md) {
          warnings.push([
            pc.cyan(ctx.page),
            `Empty page, no knowledge to extract`,
          ]);
          return;
        }

        let pathname = `/${relativeNormalized(
          ctx.siteConfig.outDir,
          id,
        ).replace("index.html", "")}`;
        if (ctx.siteConfig.cleanUrls) {
          pathname = pathname.replace(".html", "");
        }

        results.push({
          ...ctx,
          pathname,
          md: htmlToMd(root.innerHTML),
        });
      } catch (err) {
        warnings.push([pc.cyan(ctx.page), `Failed to parse HTML:`, err]);
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
          `${pc.yellow("‼")} ${pc.dim("[knowledge]")} Warnings: ${warnings.length}`,
        );
        warnings.forEach((warning) => {
          console.warn(`  ${pc.dim("-")}`, ...warning);
        });
      }
    },
  };
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
