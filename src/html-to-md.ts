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
  return htmlToMd;
}
