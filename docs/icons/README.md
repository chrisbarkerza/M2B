# M2B Icons

## Generating Icons

To generate proper PNG icons from the SVG:

1. Open `icon.svg` in a browser or image editor
2. Export to PNG at these sizes:
   - 72x72
   - 96x96
   - 128x128
   - 144x144
   - 152x152
   - 192x192
   - 384x384
   - 512x512

Or use ImageMagick:
```bash
for size in 72 96 128 144 152 192 384 512; do
  convert -background none -resize ${size}x${size} icon.svg icon-${size}.png
done
```

For now, the app will use the SVG fallback.
