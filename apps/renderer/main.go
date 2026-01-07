package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
)

func main() {
	fmt.Println("Renderer application starting...")

	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	// Parse the project file
	projectPath := filepath.Join("..", "..", "examples", "demo", "project.html")

	fmt.Printf("Parsing project file: %s\n\n", projectPath)

	project, err := ParseProject(projectPath)
	if err != nil {
		return fmt.Errorf("failed to parse project: %w", err)
	}

	// Print the parsed structure
	PrintProject(os.Stdout, project)

	fmt.Println("\nRenderer ready")
	return nil
}
