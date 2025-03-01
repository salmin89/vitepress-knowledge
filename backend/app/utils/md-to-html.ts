import { Converter, type ShowdownExtension } from "showdown";
import { isIframe } from "./is-iframe";

const converter = new Converter({
  extensions: [linkBaseUrl(), linkParentTarget()],
});

export function mdToHtml(md: string): string {
  return converter.makeHtml(md);
}

function linkBaseUrl(): ShowdownExtension {
  return {
    type: "output",
    regex: /href="\//,
    replace: `href="${DOCS_URL}/`,
  };
}

function linkParentTarget(): ShowdownExtension[] {
  if (!isIframe) return [];

  return [
    {
      type: "output",
      regex: /href="\//,
      replace: `href="${DOCS_URL}/`,
    },
  ];
}
