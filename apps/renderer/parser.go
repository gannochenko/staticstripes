package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/net/html"
)

// Project represents the parsed project structure
type Project struct {
	Sequences []Sequence
	Styles    map[string]Style
	Assets    map[string]Asset
	Outputs   []Output
}

// Sequence represents a sequence of fragments
type Sequence struct {
	Name      string
	Fragments []Fragment
}

// Fragment represents a video fragment
type Fragment struct {
	Class         string
	TransitionOut string
}

// Style represents computed CSS properties for a fragment
type Style struct {
	Width      string
	ZIndex     string
	Asset      string
	BlendMode  string
	MarginLeft string
	MarginRight string
}

// Asset represents a media asset
type Asset struct {
	Name   string
	Path   string
	Author string
}

// Output represents an output configuration
type Output struct {
	Name       string
	Path       string
	Resolution string
	FPS        string
}

// ParseProject parses the project HTML file
func ParseProject(filepath string) (*Project, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	doc, err := html.Parse(file)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	project := &Project{
		Styles: make(map[string]Style),
		Assets: make(map[string]Asset),
	}

	// Parse the document tree
	var parseNode func(*html.Node)
	parseNode = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "sequence":
				project.Sequences = append(project.Sequences, parseSequence(n))
			case "style":
				parseStyles(n, project)
			case "assets":
				parseAssets(n, project)
			case "outputs":
				parseOutputs(n, project)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			parseNode(c)
		}
	}

	parseNode(doc)
	return project, nil
}

func parseSequence(n *html.Node) Sequence {
	seq := Sequence{
		Name: getAttr(n, "name"),
	}

	// Recursively collect all fragment elements (they might be nested)
	var collectFragments func(*html.Node)
	collectFragments = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "fragment" {
			frag := Fragment{
				Class:         getAttr(node, "class"),
				TransitionOut: getAttr(node, "transition-out"),
			}
			seq.Fragments = append(seq.Fragments, frag)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			collectFragments(c)
		}
	}

	collectFragments(n)
	return seq
}

func parseStyles(n *html.Node, project *Project) {
	// Extract text content from style node
	var cssText strings.Builder
	var extractText func(*html.Node)
	extractText = func(node *html.Node) {
		if node.Type == html.TextNode {
			cssText.WriteString(node.Data)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			extractText(c)
		}
	}
	extractText(n)

	// Simple CSS parser for our custom format
	cssContent := cssText.String()

	// Split by closing brace to get each rule
	rules := strings.Split(cssContent, "}")
	for _, rule := range rules {
		rule = strings.TrimSpace(rule)
		if rule == "" {
			continue
		}

		// Find the selector (before the opening brace)
		parts := strings.Split(rule, "{")
		if len(parts) != 2 {
			continue
		}

		selector := strings.TrimSpace(parts[0])
		declarations := strings.TrimSpace(parts[1])

		// Parse declarations
		style := Style{}
		for _, decl := range strings.Split(declarations, ";") {
			decl = strings.TrimSpace(decl)
			if decl == "" {
				continue
			}

			// Split property: value
			propVal := strings.SplitN(decl, ":", 2)
			if len(propVal) != 2 {
				continue
			}

			prop := strings.TrimSpace(propVal[0])
			value := strings.TrimSpace(propVal[1])

			// Remove comments from value
			if idx := strings.Index(value, "/*"); idx != -1 {
				value = strings.TrimSpace(value[:idx])
			}

			switch prop {
			case "width":
				style.Width = value
			case "z-index":
				style.ZIndex = value
			case "-asset":
				style.Asset = value
			case "-blend-mode":
				style.BlendMode = value
			case "margin-left":
				style.MarginLeft = value
			case "margin-right":
				style.MarginRight = value
			}
		}

		// Store by class name (remove the dot)
		className := strings.TrimPrefix(selector, ".")
		project.Styles[className] = style
	}
}

func parseAssets(n *html.Node, project *Project) {
	// Recursively collect all asset elements (they might be nested)
	var collectAssets func(*html.Node)
	collectAssets = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "asset" {
			asset := Asset{
				Name:   getAttr(node, "name"),
				Path:   getAttr(node, "path"),
				Author: getAttr(node, "author"),
			}
			project.Assets[asset.Name] = asset
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			collectAssets(c)
		}
	}

	collectAssets(n)
}

func parseOutputs(n *html.Node, project *Project) {
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && c.Data == "output" {
			project.Outputs = append(project.Outputs, Output{
				Name:       getAttr(c, "name"),
				Path:       getAttr(c, "path"),
				Resolution: getAttr(c, "resolution"),
				FPS:        getAttr(c, "fps"),
			})
		}
	}
}

func getAttr(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

// PrintProject prints the parsed project structure
func PrintProject(w io.Writer, p *Project) {
	fmt.Fprintf(w, "=== PROJECT STRUCTURE ===\n\n")

	// Print sequences
	fmt.Fprintf(w, "Sequences:\n")
	for _, seq := range p.Sequences {
		fmt.Fprintf(w, "  - %s\n", seq.Name)
		for i, frag := range seq.Fragments {
			fmt.Fprintf(w, "    %d. class=%s", i+1, frag.Class)
			if frag.TransitionOut != "" {
				fmt.Fprintf(w, " (transition: %s)", frag.TransitionOut)
			}
			fmt.Fprintf(w, "\n")

			// Print computed styles for this fragment
			if style, ok := p.Styles[frag.Class]; ok {
				if style.Width != "" {
					fmt.Fprintf(w, "       width: %s\n", style.Width)
				}
				if style.ZIndex != "" {
					fmt.Fprintf(w, "       z-index: %s\n", style.ZIndex)
				}
				if style.Asset != "" {
					fmt.Fprintf(w, "       asset: %s\n", style.Asset)
				}
				if style.BlendMode != "" {
					fmt.Fprintf(w, "       blend-mode: %s\n", style.BlendMode)
				}
				if style.MarginLeft != "" {
					fmt.Fprintf(w, "       margin-left: %s\n", style.MarginLeft)
				}
				if style.MarginRight != "" {
					fmt.Fprintf(w, "       margin-right: %s\n", style.MarginRight)
				}
			}
		}
	}

	// Print assets
	fmt.Fprintf(w, "\nAssets:\n")
	for name, asset := range p.Assets {
		fmt.Fprintf(w, "  - %s: %s", name, asset.Path)
		if asset.Author != "" {
			fmt.Fprintf(w, " (by %s)", asset.Author)
		}
		fmt.Fprintf(w, "\n")
	}

	// Print outputs
	fmt.Fprintf(w, "\nOutputs:\n")
	for _, output := range p.Outputs {
		fmt.Fprintf(w, "  - %s: %s (%s @ %s fps)\n",
			output.Name, output.Path, output.Resolution, output.FPS)
	}
}
