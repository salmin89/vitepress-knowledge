import { NodeHtmlMarkdown } from "node-html-markdown";
import type { TranslatorContext } from "node-html-markdown/dist/translator";

export function createHtmlToMdConverter() {
  const postprocessCustomBlock = (
    ctx: TranslatorContext & { content: string },
  ): string | undefined => {
    if (!ctx.node.classList.contains("custom-block")) return undefined;

    const type =
      ["info", "tip", "warning", "danger", "details"].find((type) =>
        ctx.node.classList.contains(type),
      ) ?? "unknown";

    const titleNode = ctx.node.querySelector(".custom-block-title, summary");
    const title = titleNode?.textContent
      ? htmlToMd(titleNode.textContent)
      : undefined;

    const children: string[] = [];
    ctx.node
      .querySelectorAll(":scope > *:not(.custom-block-title, summary)")
      .forEach((child) => void children.push(child.outerHTML));
    const content = htmlToMd(children.join("\n"));

    const isCustomTitle = title?.toLowerCase() !== type.toLowerCase();

    if (isCustomTitle) return `:::${type} ${title}\n${content}\n:::`;
    return `:::${type}\n${content}\n:::`;
  };

  const postprocessShikiCodeBlock = (
    ctx: TranslatorContext & { content: string },
  ): string | undefined => {
    if (!ctx.node.classList.toString().includes("language-")) return undefined;

    const langNode = ctx.node.querySelector(".lang");
    const lang = langNode?.textContent ?? "";

    const contentNode = ctx.node.querySelector("pre");
    const content = contentNode ? htmlToMd(contentNode.outerHTML) : "";

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
        surroundingNewlines: true,
      },
    },
  );

  const htmlToMd = nhm.translate.bind(nhm);
  return htmlToMd;
}
