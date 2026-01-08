# Video Renderer

A Go application for parsing video project files with HTML/CSS-like syntax.

## Features

- Parses custom HTML/CSS project format
- Extracts sequences, fragments, assets, and outputs
- Computes CSS styles for each fragment
- Supports custom CSS properties (`-asset`, `-blend-mode`, etc.)

## Dependencies

- `golang.org/x/net/html` - HTML5 parser
- `github.com/chromedp/chromedp` - Chrome DevTools Protocol (for future browser automation)

## Usage

```bash
# Run the parser
make run

# Build binary
make build

# Run binary
./renderer
```

## Project File Format

The project file uses a custom XML/CSS format:

```html
<project>
  <sequence name="main">
    <fragment class="intro" transition-out="fade-to-black:1s" />
    <fragment class="outro" />
  </sequence>
</project>

<style>
  .intro {
    width: 5s;
    z-index: 0;
    -asset: intro_image;
  }
</style>

<assets>
  <asset name="intro_image" path="./images/intro.jpg" author="John Doe" />
</assets>

<outputs>
  <output name="youtube" path="./output/video.mp4" resolution="1920x1080" fps="30" />
</outputs>
```

## Structure

- `main.go` - Application entry point
- `parser.go` - Project file parser implementation
- `Makefile` - Build and run commands
