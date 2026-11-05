# v2 mockup rules (shared by layouts A to D)

Skeleton numbers are USWDS 3.14 (`design-system` skill, `references/uswds.md`). Colour, layout and expression are open.
Where these rules differ from the live site, these win for the mockups.

## Type
- Headings Rethink Sans 700, body Reddit Sans 400/600/700. Fixed scale: 14 / 17 / 22 / 32 / 40 px. Line height 1.55 body, 1.15-1.3 headings.
- Prose measure 65-75ch. Headings balance, paragraphs pretty-wrap.

## Space and shape
- 4px base: 4, 8, 12, 16, 24, 32, 48, 64. Radius 4px on controls and panels; 99px only on status pills.
- Content is capped (760 to 1360px), never full-bleed. Page gutter 24px.

## Controls
- Height 44px minimum (touch). Input border 2px, button border 2px. One primary button per screen, always visible.
- Button labels are a verb plus its object, sentence case: Calculate, Print, Download .xlsx, Download PDF.
- Focus ring 3px solid accent, 2px offset, on every focusable element.

## Colour (themes.css)
- Ten roles only: bg, surface, ink, muted, accent, on-accent, tint, mark, good, bad. Layouts never use a raw hex.
- Accent marks the primary action, links, current item. Status colour lives on pills, never on body text.
- Body contrast 4.5:1 or better in all five themes (checked with a script).

## Banned (impeccable)
- Eyebrow kickers, gradient text, glass, side-stripe borders, nested cards, icon-title-text card grids, hero-metric template.

## Not decided here
- Which layout, which theme. Default theme in the files is Kiln; the toolbar switches layout, screen and theme.
