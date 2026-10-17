---
title: Add images and assets
description: Import images into a project and control how they appear in the book.
---

# Add images and assets

Images used by a book should be kept inside its project so they remain available when you reopen or export it.

## Import an image

1. Open the **Assets** tab in the inspector.
2. Choose **Choose image** and select the file.
3. Add an image reference in the manuscript using the copied project's relative path.

```markdown
![A reader beside a window](assets/reader.jpg)
```

## Set alternative text and size

Select an image in the preview to edit its alternative text and dimensions. Leaving height blank preserves the image's proportions. The preview constrains oversized images to the page's text area.

You can also specify dimensions in Markdown alt text:

```markdown
![A landscape photograph|600](assets/coast.jpg)
![A book cover|300x450](assets/cover.jpg)
```

## Fix missing images

Keep referenced files in the project and avoid moving or renaming them after adding them to the manuscript. If an image is missing, restore the file or update its path. The export check reports missing image references before export continues.

## Next steps

- [Markdown and HTML reference](./formatting-reference)
- [Export a book](./exporting-a-book)
