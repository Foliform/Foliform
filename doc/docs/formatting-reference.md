---
title: Markdown and HTML reference
description: Markdown syntax, quote styles, and page-layout markers supported in Foliform.
---

# Markdown and HTML reference

The Foliform editor uses Markdown as its writing syntax and also accepts
supported HTML. The live preview turns the source into formatted book content.
This page collects the syntax that is most useful when preparing a
publication.

## Headings and paragraphs

Use one to six `#` characters for heading levels. Keep a space between the
hashes and heading text:

```markdown
# Chapter title

## Section heading

### Subsection heading

A regular paragraph starts after a blank line. Leave a blank line between
paragraphs when you want a new paragraph.
```

A level-one heading (`#`) is the chapter heading used by the chapter-break
setting and by the current-chapter running header. A heading followed by a
line of `---` is a Markdown setext heading, not a page break:

```markdown
Section heading
---
```

## Emphasis, links, and code

Common inline Markdown formatting is available:

```markdown
Use **bold** for emphasis, *italic* for a title, and `inline code` for a
short literal value.

[Read more](https://example.com)
```

Use triple backticks for a code block:

````markdown
```text
A monospaced block of text.
```
````

Straight apostrophes and quotation marks in prose are automatically converted
to typographic curly quotes. Inline code and HTML tags are left unchanged by
that conversion.

## Lists and tables

Use hyphens for a bulleted list and numbers for an ordered list:

```markdown
- First item
- Second item

1. Prepare the manuscript
2. Review the preview
3. Export an edition
```

GitHub Flavored Markdown tables are supported:

```markdown
| Edition | Use |
| --- | --- |
| PDF | Fixed-page print layout |
| EPUB | Reflowable ebook |
| HTML | Web edition |
```

## Block quotes and attributions

Prefix quoted lines with `>`:

```markdown
> A book is a conversation between a writer and a reader.
> — A. Writer
```

When the final line begins with an em dash (`—`) or two hyphens (`--`), it is
rendered as the quote's attribution rather than as part of the quoted text.
The same attribution convention works with a normal blockquote and with the
special `pullquote` and `epigraph` blocks below.

### Pullquotes and epigraphs

Use a fenced block for a prominent pullquote or an opening epigraph. Put the
opening marker, content, and closing marker on separate lines:

```markdown
::: pullquote
The story changes when we learn to look again.
— A. Writer
:::
```

For an epigraph, replace `pullquote` with `epigraph`:

```markdown
::: epigraph
There is no greater agony than bearing an untold story inside you.
— Maya Angelou
:::
```

The body of either block supports Markdown, including multiple paragraphs.
Fences cannot be nested. Use an ordinary `>` blockquote for inline quotations.

## Alignment blocks

Align a particular paragraph or other Markdown content without changing the
book-wide style:

```markdown
::: center
For everyone who kept reading.
:::

::: right
— The author
:::
```

Available alignment names are `left`, `center`, `right`, and `justify`. These
blocks do not turn a trailing dash line into a quote attribution.

## Columns and drop caps

Set the default book-wide text layout in the **Style** tab of the inspector.
Choose **One column**, **Two columns**, or **Three columns** to flow the
manuscript into that many columns, with chapter and section headings spanning
them. The **More → Whole-book columns** editor menu inserts a document setting
such as `::: columns 2`; this setting overrides the Style tab and is included
in preview and exports. Choose **Use Style setting** in that menu to remove
the document setting and follow the Style tab again.

For specific side-by-side content, use a columns block with one `:::column`
section per column:

```markdown
::: columns
:::column
Left-hand content
:::

:::column
Right-hand content
:::
:::
```

Each section supports regular Markdown. Its content stays in its own column;
it does not flow into the next column. When a local columns block is used,
content outside local blocks stays single-column, regardless of the Text
columns setting in Style. To apply columns to all the other content too, add
a whole-book setting such as `::: columns 2` at the top of the manuscript.
An explicit whole-book setting takes precedence outside the local blocks.

The sample project [columns-demo.md](../../samples/columns-demo.md) shows this
syntax in a complete manuscript.

Enable **Enlarge opening letters (drop caps)** to enlarge the first letter of
the book and the opening paragraph after each level-one heading. Set **Drop-cap
height** to two or three lines and choose a **Drop-cap colour**. Reset its
colour to use the style's accent colour. These are style settings, so they
apply to the preview and exported editions and can be saved in a template.

## Font and size for a paragraph

Choose a font in the editor's **Paragraph font** picker to apply it to the
paragraph at the cursor or the paragraphs containing the selection. The picker
changes only the font; the paragraph keeps the book's body font size. To set a
custom size, add it to the font block in the source:

```markdown
::: font "Poppins" 20px
This paragraph uses Poppins at 20 pixels instead of the book's body font size.
:::

::: font "Georgia" 14pt
This paragraph uses Georgia at 14 points.
:::

::: font "Georgia"
This older form changes only the font and keeps the book's body font size.
:::
```

Sizes accept `px`, `pt`, `em`, `rem`, or `%`; a unitless size is interpreted as
pixels. The picker provides Google Fonts and system fonts. Google fonts are
embedded in the project for preview and export, so save the project before
applying one. System fonts such as Georgia can be applied before saving.

## Page breaks and decorative dividers

Use a line containing three hyphens to start a new page:

```markdown
End of the previous page.

---

The next content starts on a new page.
```

Use four hyphens for a decorative divider:

```markdown
The end of one scene.

----

The next scene.
```

For either marker, leave a blank line before and after it (unless it is at the
start or end of the document). A `---` immediately below heading text is
instead interpreted as a setext heading underline. The editor also has
**Page break** and **Divider** buttons that insert these markers for you.

In HTML source, `<!-- page-break -->` marks a hard page break.

## Images and dimensions

Add an image with Markdown and descriptive alternative text:

```markdown
![A reader sitting beside a window](assets/reader.jpg)
```

Images imported through the **Assets** tab are copied into the project. Use
the path to the project asset in the Markdown reference. You can set alt text,
width, and height by selecting an image in the preview; dimensions are in
pixels. To author dimensions directly, add them after a pipe in the alt text:

```markdown
![A landscape photograph|600](assets/coast.jpg)
![A book cover|300x450](assets/cover.jpg)
```

Width-only sizing preserves the image's aspect ratio. An explicit width and
height uses both supplied dimensions. The rendered book style still constrains
images to the text area.

## Supported HTML

Raw HTML is useful when Markdown is not expressive enough. The app keeps a
sanitized set of common content elements, including headings, paragraphs,
links, images, lists, blockquotes, figures and captions, code, and tables.
Unsupported elements and attributes are removed during normalization; HTML
should be used for document content rather than scripts or embedded widgets.

To make a page break in HTML, use the `<!-- page-break -->` comment. An `<hr>`
renders as a decorative divider.
