# Image Assets

Place your image files here:

- `intro_background.jpg` - Intro card background
- `comedy_background.jpg` - Main joke delivery background
- `outro_background.jpg` - Outro card background

## Recommended Specifications

- **Format**: JPG or PNG
- **Resolution**: 1920x1080 (Full HD) or higher
- **Aspect Ratio**: 16:9 for landscape, 9:16 for vertical

## Creating Placeholder Images

You can create placeholder images using ImageMagick:

```bash
# Intro background (blue gradient)
convert -size 1920x1080 gradient:blue-darkblue intro_background.jpg

# Comedy background (yellow gradient)
convert -size 1920x1080 gradient:yellow-orange comedy_background.jpg

# Outro background (purple gradient)
convert -size 1920x1080 gradient:purple-pink outro_background.jpg
```

Or use online tools:
- https://placeholder.com/
- https://via.placeholder.com/
- https://picsum.photos/
