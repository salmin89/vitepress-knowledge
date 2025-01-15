import { Window } from "happy-dom";
import type { SiteConfig, UserConfig } from "vitepress";
import { join } from "node:path";
import { relative as relativeNormalized } from "node:path/posix";
import { writeIndexJson, writeKnowledgeFile } from "./rendering";
import { createHtmlToMdConverter } from "./html-to-md";
import pc from "picocolors";
import type { KnowledgeContext, KnowledgeOptions } from "./types";

export * from "./types";

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

  const ignore = new Set(options?.ignore);
  ignore.add("404.md");

  return {
    // Allow extending another theme/config
    extends: options?.extends,

    // Get HTML page contents as markdown
    transformHtml(code, id, ctx) {
      if (ignore.has(ctx.page)) return;

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
        if (selector == null) {
          warnings.push([
            pc.cyan(ctx.page),
            `No selector found, falling back to "body". You probably want to provide a custom selector for this page/layout to filter out navigation`,
          ]);
        }
        const root = document.querySelector(selector ?? "body");
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

      const pageOrderMap = getPageOrder(siteConfig);
      console.debug(pageOrderMap);
      results.sort((a, b) => {
        const aOrder = pageOrderMap[a.page] ?? Number.MAX_SAFE_INTEGER;
        const bOrder = pageOrderMap[b.page] ?? Number.MAX_SAFE_INTEGER;
        const orderDiff = aOrder - bOrder;
        if (orderDiff !== 0) return orderDiff;

        return a.page.localeCompare(b.page);
      });

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

type PageOrderMap = Record<string, number | undefined>;
export function getPageOrder(siteConfig: SiteConfig): PageOrderMap {
  const pageOrderMap: PageOrderMap = {};

  function traverseItems(items: any[], prefix: string = ""): string[] {
    const paths: string[] = [];
    for (const item of items) {
      if (typeof item === "string") {
        paths.push(prefix + item);
      } else if (item.link) {
        paths.push(prefix + item.link);
      }
      if (item.items) {
        paths.push(...traverseItems(item.items, prefix));
      }
    }
    return paths;
  }

  // const navPaths = traverseItems((siteConfig.site as any)?.themeConfig?.nav ?? []);
  const sidebarPaths = traverseItems(
    (siteConfig.site as any)?.themeConfig?.sidebar ?? [],
  );
  const allPaths = [
    // Homepage first
    "index.md",
    // Then use the sidebar for order
    ...sidebarPaths,
    // ...navPaths,
  ]
    .map((path) => (path.endsWith(".md") ? path : path + ".md"))
    .map((path) => (path.startsWith("/") ? path.substring(1) : path));

  allPaths.forEach((path, index) => {
    pageOrderMap[path] = index;
  });

  return pageOrderMap;
}
