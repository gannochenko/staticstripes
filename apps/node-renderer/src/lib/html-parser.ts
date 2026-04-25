import * as htmlparser2 from 'htmlparser2';
import { readFile } from 'fs/promises';
import * as csstree from 'css-tree';
import type { Element, AnyNode, Document } from 'domhandler';
import {
  ParsedProject,
  ParsedNode,
  ProjectContent,
  Asset,
  BasePath,
  Output,
  Sequence,
  Fragment,
  FragmentApp,
  FFmpegOption,
  CSSProperties,
} from './type';

/**
 * HTMLParser for node-based project files
 *
 * Parses HTML files containing node definitions:
 * - <node.project> - main project node
 * - <node.filesystem> - filesystem output node
 * - <node.youtube> - YouTube upload node
 * - <node.s3> - S3 upload node
 * - <node.instagram> - Instagram upload node
 * - <node.ai_music_api_ai> - AI Music API integration node
 * - <node.elevenlabs> - ElevenLabs integration node
 * - <node.openai> - OpenAI integration node
 */
export class HTMLParser {
  /**
   * Parses an HTML file into a ParsedProject
   * @param filePath - Absolute or relative path to the HTML file
   * @returns Promise resolving to the parsed project
   */
  public async parseFile(filePath: string): Promise<ParsedProject> {
    const content = await readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parses HTML string into a ParsedProject
   * @param html - HTML string to parse
   * @returns The parsed project with nodes
   */
  public parse(html: string): ParsedProject {
    const ast = htmlparser2.parseDocument(html, {
      xmlMode: true, // Enable XML mode for proper self-closing tag support
      lowerCaseTags: false, // Preserve case for custom tags
      lowerCaseAttributeNames: false, // Preserve case for attributes
    });

    const nodes: ParsedNode[] = [];
    let projectNode: ParsedNode | null = null;
    const outputs: Output[] = [];

    // Extract top-level <outputs> element
    this.extractOutputs(ast, outputs);

    // Traverse the AST and find all node elements
    this.traverseAndExtractNodes(ast, nodes);

    // Find the project node
    projectNode = nodes.find((node) => node.type === 'project') || null;

    return {
      ast,
      nodes,
      projectNode,
      outputs,
    };
  }

  /**
   * Traverses the AST and extracts all node elements
   */
  private traverseAndExtractNodes(node: AnyNode, nodes: ParsedNode[]): void {
    const traverse = (currentNode: AnyNode) => {
      if (currentNode.type === 'tag') {
        const element = currentNode as Element;

        // Check if this is a node element (tag name starts with "node.")
        if (element.name.startsWith('node.')) {
          const nodeType = element.name.substring(5); // Remove "node." prefix
          const parsedNode = this.extractNode(element, nodeType);
          nodes.push(parsedNode);
        }
      }

      if ('children' in currentNode && currentNode.children) {
        for (const child of currentNode.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
  }

  /**
   * Extracts a node from an element
   */
  private extractNode(element: Element, nodeType: string): ParsedNode {
    const attributes = this.getAttributes(element);
    const children = this.getChildElements(element);
    const name = attributes.get('name');
    const when = attributes.get('when');

    const node: ParsedNode = {
      type: nodeType,
      name,
      element,
      attributes,
      children,
      when,
    };

    // If this is a project node, parse its content
    if (nodeType === 'project') {
      node.projectContent = this.parseProjectContent(element);
    }

    return node;
  }

  /**
   * Parses the content of a project node
   */
  private parseProjectContent(projectElement: Element): ProjectContent {
    // Extract title
    const title = this.extractTitle(projectElement);

    // Extract tags
    const tags = this.extractTags(projectElement);

    // Extract and parse CSS
    const cssText = this.extractCSS(projectElement);
    const cssRules = csstree.parse(cssText);
    const styleRules = this.buildStyleRules(cssRules);
    const css = new Map<Element, CSSProperties>();
    this.applyStylesToElement(projectElement, styleRules, css);

    // Extract base paths
    const basePaths = this.extractBasePaths(projectElement);

    // Extract assets
    const assets = this.extractAssets(projectElement);

    // Extract sequences
    const sequences = this.extractSequences(projectElement);

    // Extract ffmpeg options
    const ffmpegOptions = this.extractFFmpegOptions(projectElement);

    return {
      title,
      tags,
      cssText,
      css,
      basePaths,
      assets,
      sequences,
      ffmpegOptions,
    };
  }

  /**
   * Extracts title from project element
   */
  private extractTitle(projectElement: Element): string | undefined {
    const titleElements = findChildElementsByTagName(projectElement, 'title');
    if (titleElements.length > 0) {
      return getTextContent(titleElements[0]).trim();
    }
    return undefined;
  }

  /**
   * Extracts tags from project element
   */
  private extractTags(projectElement: Element): string[] {
    const tagElements = findChildElementsByTagName(projectElement, 'tag');
    return tagElements.map((el) => getTextContent(el).trim()).filter(Boolean);
  }

  /**
   * Extracts CSS text from <style> elements
   */
  private extractCSS(projectElement: Element): string {
    const styleElements = this.findDescendantsByTagName(
      projectElement,
      'style',
    );
    return styleElements.map((el) => getTextContent(el)).join('\n');
  }

  /**
   * Builds a map of CSS rules from the parsed CSS AST
   */
  private buildStyleRules(
    cssAst: csstree.CssNode,
  ): Array<{ selector: string; properties: CSSProperties }> {
    const rules: Array<{ selector: string; properties: CSSProperties }> = [];

    csstree.walk(cssAst, {
      visit: 'Rule',
      enter: (node) => {
        const rule = node as csstree.Rule;
        const selector = csstree.generate(rule.prelude);
        const properties: CSSProperties = {};

        csstree.walk(rule.block, {
          visit: 'Declaration',
          enter: (declNode) => {
            const decl = declNode as csstree.Declaration;
            const property = decl.property;
            const value = csstree.generate(decl.value);
            properties[property] = value;
          },
        });

        rules.push({ selector, properties });
      },
    });

    return rules;
  }

  /**
   * Applies CSS rules to all elements in a tree
   */
  private applyStylesToElement(
    node: AnyNode,
    styleRules: Array<{ selector: string; properties: CSSProperties }>,
    elementsMap: Map<Element, CSSProperties>,
  ): void {
    const traverse = (currentNode: AnyNode) => {
      if (currentNode.type === 'tag') {
        const element = currentNode as Element;
        const computedStyles: CSSProperties = {};

        // Apply matching rules (CSS classes and IDs)
        for (const rule of styleRules) {
          if (this.matchesSelector(element, rule.selector)) {
            Object.assign(computedStyles, rule.properties);
          }
        }

        elementsMap.set(element, computedStyles);
      }

      if ('children' in currentNode && currentNode.children) {
        for (const child of currentNode.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
  }

  /**
   * Checks if an element matches a CSS selector (simplified implementation)
   */
  private matchesSelector(element: Element, selector: string): boolean {
    const trimmedSelector = selector.trim();

    // Class selector
    if (trimmedSelector.startsWith('.')) {
      const className = trimmedSelector.slice(1);
      const classAttr = element.attribs?.class;
      const classes = classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
      return classes.includes(className);
    }

    // Tag selector
    if (/^[a-z]+$/i.test(trimmedSelector)) {
      return element.name === trimmedSelector;
    }

    // ID selector
    if (trimmedSelector.startsWith('#')) {
      const id = trimmedSelector.slice(1);
      return element.attribs?.id === id;
    }

    return false;
  }

  /**
   * Extracts base paths from <basePaths> section
   */
  private extractBasePaths(projectElement: Element): BasePath[] {
    const basePathsElements = findChildElementsByTagName(
      projectElement,
      'basePaths',
    );
    if (basePathsElements.length === 0) {
      return [];
    }

    const basePathsElement = basePathsElements[0];
    const pathElements = findChildElementsByTagName(basePathsElement, 'path');

    return pathElements
      .map((pathEl) => {
        const attrs = this.getAttributes(pathEl);
        const name = attrs.get('name');
        const path = getTextContent(pathEl).trim();

        if (!name || !path) {
          return null;
        }

        return { name, path };
      })
      .filter((basePath): basePath is BasePath => basePath !== null);
  }

  /**
   * Extracts assets from <assets> section
   */
  private extractAssets(projectElement: Element): Asset[] {
    const assetsElements = findChildElementsByTagName(projectElement, 'assets');
    if (assetsElements.length === 0) {
      return [];
    }

    const assetsElement = assetsElements[0];
    const assetElements = findChildElementsByTagName(assetsElement, 'asset');

    return assetElements
      .map((assetEl) => {
        const attrs = this.getAttributes(assetEl);
        const name = attrs.get('name');
        if (!name) {
          return null;
        }

        const asset: Asset = { name };

        // Either path or input, not both
        const path = attrs.get('path');
        const input = attrs.get('input');

        if (path) {
          asset.path = path;
        } else if (input) {
          asset.input = input;
        }

        const author = attrs.get('author');
        if (author) {
          asset.author = author;
        }

        return asset;
      })
      .filter((asset): asset is Asset => asset !== null);
  }

  /**
   * Extracts outputs from top-level <outputs> element
   */
  private extractOutputs(ast: Document, outputs: Output[]): void {
    // Traverse the AST to find top-level <outputs> element
    const traverse = (node: AnyNode) => {
      if (node.type === 'tag') {
        const element = node as Element;

        // Check if this is the <outputs> element
        if (element.name === 'outputs') {
          const outputElements = findChildElementsByTagName(element, 'output');

          for (const outputEl of outputElements) {
            const attrs = this.getAttributes(outputEl);
            const name = attrs.get('name');
            const resolution = attrs.get('resolution');
            const fpsStr = attrs.get('fps');

            if (name && resolution) {
              const fps = fpsStr ? parseInt(fpsStr, 10) : 30;
              outputs.push({
                name,
                resolution,
                fps,
              });
            }
          }
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(ast);
  }

  /**
   * Extracts sequences from <sequences> section
   */
  private extractSequences(projectElement: Element): Sequence[] {
    const sequencesElements = findChildElementsByTagName(
      projectElement,
      'sequences',
    );
    if (sequencesElements.length === 0) {
      return [];
    }

    const sequencesElement = sequencesElements[0];
    const sequenceElements = findChildElementsByTagName(
      sequencesElement,
      'sequence',
    );

    return sequenceElements.map((sequenceEl) => {
      const fragmentElements = this.findDescendantsByTagName(
        sequenceEl,
        'fragment',
      );

      const fragments: Fragment[] = fragmentElements.map((fragEl) => {
        const attrs = this.getAttributes(fragEl);

        // Parse optional inline <app> child element
        let app: FragmentApp | undefined;
        const appElements = findChildElementsByTagName(fragEl, 'app');
        if (appElements.length > 0) {
          const appEl = appElements[0];
          const appAttrs = this.getAttributes(appEl);
          const src = appAttrs.get('src') || '';
          const parametersStr = appAttrs.get('data-parameters') || '{}';
          let parameters: Record<string, string> = {};
          try {
            parameters = JSON.parse(parametersStr);
          } catch {
            console.warn(`⚠️  Failed to parse app data-parameters: ${parametersStr}`);
          }
          if (src) {
            app = { src, parameters };
          }
        }

        return {
          class: attrs.get('class'),
          id: attrs.get('id'),
          timecode: attrs.get('timecode'),
          element: fragEl,
          app,
        };
      });

      return { fragments };
    });
  }

  /**
   * Extracts FFmpeg options from <ffmpeg> section
   */
  private extractFFmpegOptions(projectElement: Element): FFmpegOption[] {
    const ffmpegElements = findChildElementsByTagName(projectElement, 'ffmpeg');
    if (ffmpegElements.length === 0) {
      return [];
    }

    const ffmpegElement = ffmpegElements[0];
    const optionElements = findChildElementsByTagName(ffmpegElement, 'option');

    return optionElements
      .map((optionEl) => {
        const attrs = this.getAttributes(optionEl);
        const name = attrs.get('name');
        if (!name) {
          return null;
        }

        const args = getTextContent(optionEl).trim();

        return {
          name,
          args,
        };
      })
      .filter((option): option is FFmpegOption => option !== null);
  }

  /**
   * Finds all descendant elements with a specific tag name (recursive)
   */
  private findDescendantsByTagName(element: Element, tagName: string): Element[] {
    const results: Element[] = [];

    const traverse = (node: AnyNode) => {
      if (node.type === 'tag') {
        const el = node as Element;
        if (el.name === tagName) {
          results.push(el);
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    if ('children' in element && element.children) {
      for (const child of element.children) {
        traverse(child);
      }
    }

    return results;
  }

  /**
   * Extracts attributes from an element as a Map
   */
  private getAttributes(element: Element): Map<string, string> {
    const map = new Map<string, string>();
    if (element.attribs) {
      for (const [name, value] of Object.entries(element.attribs)) {
        map.set(name, value);
      }
    }
    return map;
  }

  /**
   * Gets direct child elements of a node
   */
  private getChildElements(element: Element): Element[] {
    const children: Element[] = [];

    if ('children' in element && element.children) {
      for (const child of element.children) {
        if (child.type === 'tag') {
          children.push(child as Element);
        }
      }
    }

    return children;
  }
}

/**
 * Helper to get text content from a node
 * @param node - Node to extract text from
 * @returns Concatenated text content
 */
export function getTextContent(node: AnyNode): string {
  let text = '';

  function traverse(currentNode: AnyNode) {
    if (currentNode.type === 'text' && 'data' in currentNode) {
      text += currentNode.data;
    }

    if ('children' in currentNode && currentNode.children) {
      for (const child of currentNode.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return text;
}

/**
 * Helper to find child elements by tag name
 * @param element - Parent element to search in
 * @param tagName - Tag name to search for
 * @returns Array of matching child elements
 */
export function findChildElementsByTagName(
  element: Element,
  tagName: string,
): Element[] {
  const results: Element[] = [];

  if ('children' in element && element.children) {
    for (const child of element.children) {
      if (child.type === 'tag') {
        const childElement = child as Element;
        if (childElement.name === tagName) {
          results.push(childElement);
        }
      }
    }
  }

  return results;
}
