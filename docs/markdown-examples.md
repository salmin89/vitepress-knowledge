# Markdown Extension Examples

This page demonstrates some of the built-in markdown extensions provided by VitePress.

## Syntax Highlighting

VitePress provides Syntax Highlighting powered by [Shiki](https://github.com/shikijs/shiki), with additional features like line-highlighting:

**Input**

````md
```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```
````

**Output**

```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

:::code-group

```js [JS]
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

```ts [TS]
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

:::

## Custom Containers

**Input**

```md
::: info
This is an info box.
:::

::: tip
This is a tip.
:::

::: warning
This is a warning.
:::

::: danger
This is a dangerous warning.
:::

::: details
This is a details block.
:::
```

**Output**

::: info TITLE
This is an info box.
:::

::: tip TITLE
This is a tip.
:::

::: warning TITLE
This is a warning.
:::

::: danger TITLE
This is a dangerous warning.
:::

::: details TITLE
This is a details block.

This is a details block.
:::

## More

Check out the documentation for the [full list of markdown extensions](https://vitepress.dev/guide/markdown).
