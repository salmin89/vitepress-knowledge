import { Converter, type ShowdownExtension } from "showdown";

const converter = new Converter({
  extensions: [linkBaseUrl()],
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
