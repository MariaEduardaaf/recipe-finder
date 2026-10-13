# Pantry Recipe Finder

A free "what can I cook with what I have?" tool: tick the ingredients in your kitchen and see what you can cook now, and what needs one more thing.

![Pantry Recipe Finder](public/og-default.png)

## What it does

- **My kitchen:** search or browse ingredients, start from a pack (basics, breakfast, baking), and keep the list on your device. Clear it, then undo.
- **Answers first:** "You can cook N recipes", plus a view of the recipes missing one ingredient, grouped by what's missing.
- **Filters:** meal, cuisine, diet (worked out from the ingredients) and leave out an ingredient.
- **Smart matching:** ingredient names are normalized, so "scallions" and "spring onions" both count as green onions.
- **Pages by ingredient:** 30 "recipes with X" pages with structured data.
- **Recipes open on the site that published them.** The finder never copies instructions.

## Data

Recipe data and photos come from [TheMealDB](https://www.themealdb.com/). The data files aren’t in this repository: `scripts/fetch-recipes.mjs` downloads them with TheMealDB’s free developer key, and a public launch needs their paid key. Dead source links are swapped for the TheMealDB page (`scripts/fetch-recipes.mjs --check-links`). Matching and the curated picks have self-checks: `normalize.check.ts` and `picks.check.ts` in `src/components/recipes/`.

## Quality bar

- WCAG 2.1 AA: contrast checked on every color pair in light and dark mode, visible focus, labeled inputs, 44px touch targets and reduced motion
- Responsive from 320px to wide desktop with no sideways scrolling
- Every state is designed: empty, loading, zero results, errors, and no JavaScript
- SEO: semantic headings, canonical URLs, structured data, a sitemap and Open Graph images

## Stack

- [Astro 7](https://astro.build) with static output, plain TypeScript and plain CSS (no UI framework)
- One design system: tokens in `src/styles/tokens.css`, a component kit in `src/components/ui/`, and Public Sans served through Astro's Fonts API
- A logo drawn for this product, with the three concepts it was chosen from, in [`docs/brand/`](docs/brand/)
- Inline SVG icons from [Lucide](https://lucide.dev) (ISC)
- No tracking and no accounts; anything saved stays in the visitor's browser

## Run it

```bash
pnpm install
node scripts/fetch-recipes.mjs   # downloads the TheMealDB data (not stored in this repo)
pnpm dev          # http://localhost:4321
pnpm astro check  # types
pnpm build        # static site in dist/
```

## Status

A working prototype. Before a public launch, fill in the fields marked `OWNER TO FILL` in `src/site.ts` (name, domain, contact and host), then set `prototypeNotices` to `false`. The build fails while a required field is empty.

## License

No license: © 2026 Maria Eduarda, all rights reserved. You're welcome to read the code; please ask before reusing it.
