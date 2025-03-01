import { Converter, type ShowdownExtension } from "showdown";

const converter = new Converter({
  extensions: [linkBaseUrl()],
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
    regex: /href="\//,
    replace: `href="${DOCS_URL}/`,
  };
}
