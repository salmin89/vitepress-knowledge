import { Converter, type ShowdownExtension } from "showdown";

const converter = new Converter({
  extensions: [linkBaseUrl(), linkTarget()],
});

export function mdToHtml(md: string): string {
  return converter.makeHtml(md);
}

/**
 * Add a base URL to the docs if anchors are absolute paths.
 * "/" -> "https://wxt.dev/"
 */
function linkBaseUrl(): ShowdownExtension {
  return {
    type: "output",
    regex: /href="\//g,
    replace: `href="${DOCS_URL}/`,
  };
}

/**
 * Always open markdown links in new tabs. For now, this is done to preserve the
 * conversation in the open tab, which would otherwise be cleared when
 * changing URLs.
 */
function linkTarget(): ShowdownExtension {
  return {
    type: "output",
    regex: /<a /g,
    replace: `<a target="_blank" `,
  };
}
