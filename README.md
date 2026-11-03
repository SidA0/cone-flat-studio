# Cone Flat Studio

A static, browser-local STEP to flat-pattern tool for analytic exhaust cones. Open `index.html` through a static server or publish the folder with GitHub Pages. No build step or external runtime is required.

The supplied example STEP was used to verify two complete conical sheet blanks, but its source geometry is not included in this repository. `Explore supplied example` loads only precomputed dimensions.

## Geometry and limits

The reader extracts `CONICAL_SURFACE` faces with two `CIRCLE` and two `LINE` edges, groups adjacent half-faces within each STEP shell, and chooses the larger-radius side of a sheet wall. Very narrow conical faces (less than 5% of the longest cone slant in the same body) are listed as excluded bevels. The true development uses `R = r / sin(alpha)` and `flat sweep = original sweep × sin(alpha)`.

Exports are full-size millimetre AP214 STEP planar sheet faces, R12 DXF with ARC and LINE entities, and a dimension CSV. The STEP sheet faces have zero thickness and retain analytic circular arcs. Exports do not include kerf, seam allowance, weld overlap, neutral-axis correction, or nesting. Review all dimensions and excluded faces in CAD before manufacturing.

## GitHub Pages

Push this folder to a public GitHub repository. In **Settings → Pages**, set **Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`. The site then appears at `https://<username>.github.io/<repository>/`.

## Local check

Run `node --test tests/*.test.mjs` for the geometry and export smoke tests. Serve the folder with any static HTTP server for browser testing.
