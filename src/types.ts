import type { TransformContext } from "vitepress";

export type KnowledgeContext = TransformContext & {
  md: string;
  pathname: string;
};
