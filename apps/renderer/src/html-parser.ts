import * as htmlparser2 from 'htmlparser2';
import { readFile } from 'fs/promises';
import * as csstree from 'css-tree';
import { CSSProperties, ParsedHtml } from './type';
import type { Element, AnyNode, Document } from 'domhandler';

export type ASTNode = AnyNode;
export type { Document, Element };

export interface EnhancedElement extends Element {
  computedStyles?: CSSProperties;
}

interface StyleRule {
  selector: string;
  properties: CSSProperties;
}

export class HTMLParser {
  /**
   * Parses an HTML file into an AST with computed CSS using parse5 and css-tree
   * @param filePath - Absolute or relative path to the HTML file
   * @returns Promise resolving to the parsed project with AST and computed styles
   */
  public async parseFile(filePath: string): Promise<ParsedHtml> {
    const content = await readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parses HTML string into an AST with computed CSS
   * @param html - HTML string to parse
   * @returns The parsed project with AST and computed styles
   */
  public parse(html: string): ParsedHtml {
    const ast = htmlparser2.parseDocument(html, {
      xmlMode: true, // Enable XML mode for proper self-closing tag support
      lowerCaseTags: false, // Preserve case for custom tags
      lowerCaseAttributeNames: false, // Preserve case for attributes
    });
    const cssText = this.extractCSS(ast);
    const cssRules = csstree.parse(cssText);
    const elements = new Map<Element, CSSProperties>();

    // Build the CSS rule map
    const styleRules = this.buildStyleRules(cssRules);

    // Apply styles to all elements
    this.traverseAndApplyStyles(ast, styleRules, elements);

    return { ast, css: elements, cssText };
  }

  /**
   * Extracts CSS text from <style> elements in the document
   */
  private extractCSS(ast: Document): string {
    const styleElements = findElementsByTagName(ast, 'style');
    return styleElements.map((el) => getTextContent(el)).join('\n');
  }

  /**
   * Builds a map of CSS rules from the parsed CSS AST
   */
  private buildStyleRules(cssAst: csstree.CssNode): StyleRule[] {
    const rules: StyleRule[] = [];

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
   * Gets the class attribute value from an element
   */
  private getClassNames(element: Element): string[] {
    const classAttr = element.attribs?.class;
    return classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
  }

  /**
   * Checks if an element matches a CSS selector (simplified implementation)
   */
  private matchesSelector(element: Element, selector: string): boolean {
    const trimmedSelector = selector.trim();

    // Class selector
    if (trimmedSelector.startsWith('.')) {
      const className = trimmedSelector.slice(1);
      return this.getClassNames(element).includes(className);
    }

    // Tag selector
    if (/^[a-z]+$/i.test(trimmedSelector)) {
      return element.name === trimmedSelector;
    }

    // ID selector (basic support)
    if (trimmedSelector.startsWith('#')) {
      const id = trimmedSelector.slice(1);
      return element.attribs?.id === id;
    }

    return false;
  }

  /**
   * Applies CSS rules to all elements in the AST
   */
  private traverseAndApplyStyles(
    node: ASTNode,
    styleRules: StyleRule[],
    elementsMap: Map<Element, CSSProperties>,
  ): void {
    const traverse = (currentNode: ASTNode) => {
      if (currentNode.type === 'tag') {
        const element = currentNode as Element;
        const computedStyles: CSSProperties = {};

        // Apply matching rules
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
}

/**
 * Helper to find elements by tag name in the AST
 * @param node - Starting node to search from
 * @param tagName - Tag name to search for
 * @returns Array of matching element nodes
 */
export function findElementsByTagName(
  node: ASTNode,
  tagName: string,
): Element[] {
  const results: Element[] = [];

  function traverse(currentNode: ASTNode) {
    if (currentNode.type === 'tag' && (currentNode as Element).name === tagName) {
      results.push(currentNode as Element);
    }

    if ('children' in currentNode && currentNode.children) {
      for (const child of currentNode.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return results;
}

/**
 * Helper to get text content from a node
 * @param node - Node to extract text from
 * @returns Concatenated text content
 */
export function getTextContent(node: ASTNode): string {
  let text = '';

  function traverse(currentNode: ASTNode) {
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

// /**
//  * Helper to get computed styles for an element
//  * @param element - Element to get styles for
//  * @param elementsMap - Map of elements to their computed styles
//  * @returns Computed styles for the element
//  */
// export function getComputedStyles(
//   element: Element,
//   elementsMap: Map<Element, CSSProperties>,
// ): CSSProperties {
//   return elementsMap.get(element) || {};
// }
