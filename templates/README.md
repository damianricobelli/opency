# Shared templates

- **`base/`:** the infrastructure common to all brands.
  - `base.css` defines the canvas, the zones per format, the type scale by role, the materials (textures, photos, veils, scrim, glass, chips) and motion.
  - `slide.html` is the blank slide.
- **`layouts/`:** 20 slide archetypes tested against quality control. See its README.

Each brand's own templates (approved pieces) live in `brands/<brand>/templates/<name>/`.

`npx @opency/cli new` copies the slides to `brands/<brand>/pieces/<id>/` and adjusts the paths to that brand's tokens, assets and logo. The layouts are rendered with the `_demo` brand.
