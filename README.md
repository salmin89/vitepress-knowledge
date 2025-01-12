# VitePress Knowledge

```sh
pnpm i vitepress-knowledge
```

Generate knowledge files for AI models to use. This plugin works by looking at all the HTML files output, converting them back to markdown, then merging all the files into a single `knowledge.txt` file.

## TODO

- [x] Generate knowledge file
- [ ] Add tests for HTML &rarr; markdown conversion
- [ ] OpenAI assistant integration for uploading knowledge file
- [ ] Claude.ai integration for using knowledge file
- [ ] Add Chat UI to website

## Setup

1. Extend the `knowledge` plugin:

   ```ts
   // docs/.vitepress/config.ts
   import { defineConfig } from "vitepress";
   import knowledge from "vitepress-knowledge";

   export default defineConfig({
     extends: knowledge(),
   });
   ```

2. Build your site:
   ```sh
   $ bun vitepress build docs
   ✓ building client + server bundles...
   ✓ rendering pages...
   ✓ generated docs/.vitepress/dist/knowledge.txt
   ```

And that's it! Your knowledge file will be available at `https://example.com/knowledge.txt` when publishing your docs. The knowledge file will not be generated during development.

## Integrations

### OpenAI Assistant

TODO: Automatically upload your knowledge file to an assistant. Then provide a chat interface for asking the bot questions.

### Claude.ai

TODO.

## Selectors

By default, this plugin only adds page content to the knowledge file, not the navigation, sidebar, or aside. To customize which content should be added to the knowledge file, you can use the `selector`, `layoutSelectors`, and `pageSelectors` options.

- `pageSelectors`: Specify which content should be added for a specific page
- `layoutSelectors`: Specify which content should be added for a specific layout (if not specified in the `pageSelectors`)
- `selector`: Specify which content should be added (if not specified in the `pageSelectors` or `layoutSelectors`)

## Extending Other Themes

You can use the `extends` option to extend another theme.

```ts
export default defineConfig({
  extends: knowledge({
    extends: someOtherTheme(),
  }),
});
```

Right now, the HTML to markdown conversion for custom containers may not look good for any theme other than the default one.
