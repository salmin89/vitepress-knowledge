import { Converter, type ShowdownExtension } from "showdown";
import { isIframe } from "./is-iframe";

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
 * Adds the proper target to links.
 */
function linkTarget(): ShowdownExtension {
  return {
    type: "output",
    regex: /<a /g,
    replace: `<a target="${isIframe ? "_parent" : "_blank"}" `,
  };
}
