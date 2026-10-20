---
title: Choose a book style
description: Adjust typography, color, page size, and chapter starts for a manuscript.
---

# Choose a book style

Use the **Style** tab in the inspector to control how the manuscript is typeset. A style applies to the current book and can be changed without rewriting its content.

## Choose a starting style

Template selection is temporarily unavailable. Use the Style controls below to
adjust this manuscript directly.

See [Templates and styles](/docs/templates-and-styles) for the current template feature status and its usage guide.

## Adjust typography and pages

Depending on the selected style, you can set title, subtitle, and body fonts and sizes, line height, text and page colors, page size, and margins. The font picker offers Google Fonts and system fonts; Google fonts are embedded in the project for preview and export.

Choose **One column**, **Two columns**, or **Three columns** for the default body layout. Chapter and section headings span all columns.

You can also set the whole-book layout from the editor's **More → Whole-book columns** menu. It inserts a `::: columns 2` setting into the manuscript source; change `2` to `1` or `3` to set a different count. This source setting overrides the Style tab until you choose **Use Style setting** from the same menu. Preview and exports use the same setting.

For specific side-by-side content, use a `::: columns` block containing a `:::column` section for each column. Each section accepts Markdown and stays in its own column. Content outside local column blocks remains single-column, even if the Style tab is set to two or three columns. Add a whole-book `::: columns 2` directive when you also want the surrounding content in columns. See the [formatting reference](./formatting-reference.md#columns-and-drop-caps) or the [columns demo](../../samples/columns-demo.md).

Turn on **Enlarge opening letters (drop caps)** to enlarge the first letter of the book and the first paragraph after each level-one chapter heading. Choose a height of two or three lines and set its colour; reset the colour to use the style's accent colour. The drop-cap settings and column layout are included in saved templates and are applied in preview and exports.

Turn on **Start every chapter (H1) on a new page** when each level-one heading should begin a fresh page.

## Check the result

Review the affected pages in Book or PDF View after changing fonts, sizes, margins, or chapter behavior. The same content can be styled for different kinds of books.

## Next steps

- [Templates and styles](/docs/templates-and-styles)
- [Preview modes](/docs/preview-modes)
