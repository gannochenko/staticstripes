import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { readFile } from 'fs/promises';
import * as csstree from 'css-tree';

export type ASTNode = DefaultTreeAdapterMap['node'];
export type Document = DefaultTreeAdapterMap['document'];
export type Element = DefaultTreeAdapterMap['element'];
export type Attribute = DefaultTreeAdapterMap['attribute'];

export interface CSSProperties {
  [key: string]: string;
}

export interface EnhancedElement extends Element {
  computedStyles?: CSSProperties;
}

export interface ParsedProject {
  ast: Document;
  elements: Map<Element, CSSProperties>;
  cssRules: csstree.CssNode;
}

/**
 * Parses an HTML file into an AST with computed CSS using parse5 and css-tree
 * @param filePath - Absolute or relative path to the HTML file
 * @returns Promise resolving to the parsed project with AST and computed styles
 */
export async function parseHTMLFile(filePath: string): Promise<ParsedProject> {
  const content = await readFile(filePath, 'utf-8');
  return parseHTML(content);
}

/**
 * Parses HTML string into an AST with computed CSS
 * @param html - HTML string to parse
 * @returns The parsed project with AST and computed styles
 */
export function parseHTML(html: string): ParsedProject {
  const ast = parse(html);
  const cssText = extractCSS(ast);
  const cssRules = csstree.parse(cssText);
  const elements = new Map<Element, CSSProperties>();

  // Build the CSS rule map
  const styleRules = buildStyleRules(cssRules);

  // Apply styles to all elements
  traverseAndApplyStyles(ast, styleRules, elements);

  return { ast, elements, cssRules };
}

/**
 * Extracts CSS text from <style> elements in the document
 */
function extractCSS(ast: Document): string {
  const styleElements = findElementsByTagName(ast, 'style');
  return styleElements.map((el) => getTextContent(el)).join('\n');
}

interface StyleRule {
  selector: string;
  properties: CSSProperties;
}

/**
 * Builds a map of CSS rules from the parsed CSS AST
 */
function buildStyleRules(cssAst: csstree.CssNode): StyleRule[] {
  const rules: StyleRule[] = [];

  csstree.walk(cssAst, {
    visit: 'Rule',
    enter(node) {
      const rule = node as csstree.Rule;
      const selector = csstree.generate(rule.prelude);
      const properties: CSSProperties = {};

      csstree.walk(rule.block, {
        visit: 'Declaration',
        enter(declNode) {
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
function getClassNames(element: Element): string[] {
  const classAttr = element.attrs.find((attr) => attr.name === 'class');
  return classAttr ? classAttr.value.split(/\s+/).filter(Boolean) : [];
}

/**
 * Checks if an element matches a CSS selector (simplified implementation)
 */
function matchesSelector(element: Element, selector: string): boolean {
  const trimmedSelector = selector.trim();

  // Class selector
  if (trimmedSelector.startsWith('.')) {
    const className = trimmedSelector.slice(1);
    return getClassNames(element).includes(className);
  }

  // Tag selector
  if (/^[a-z]+$/i.test(trimmedSelector)) {
    return element.tagName === trimmedSelector;
  }

  // ID selector (basic support)
  if (trimmedSelector.startsWith('#')) {
    const id = trimmedSelector.slice(1);
    const idAttr = element.attrs.find((attr) => attr.name === 'id');
    return idAttr?.value === id;
  }

  return false;
}

/**
 * Applies CSS rules to all elements in the AST
 */
function traverseAndApplyStyles(
  node: ASTNode,
  styleRules: StyleRule[],
  elementsMap: Map<Element, CSSProperties>
) {
  function traverse(currentNode: ASTNode) {
    if ('tagName' in currentNode) {
      const element = currentNode as Element;
      const computedStyles: CSSProperties = {};

      // Apply matching rules
      for (const rule of styleRules) {
        if (matchesSelector(element, rule.selector)) {
          Object.assign(computedStyles, rule.properties);
        }
      }

      elementsMap.set(element, computedStyles);
    }

    if ('childNodes' in currentNode && currentNode.childNodes) {
      for (const child of currentNode.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(node);
}

/**
 * Helper to find elements by tag name in the AST
 * @param node - Starting node to search from
 * @param tagName - Tag name to search for
 * @returns Array of matching element nodes
 */
export function findElementsByTagName(
  node: ASTNode,
  tagName: string
): Element[] {
  const results: Element[] = [];

  function traverse(currentNode: ASTNode) {
    if ('tagName' in currentNode && currentNode.tagName === tagName) {
      results.push(currentNode as Element);
    }

    if ('childNodes' in currentNode && currentNode.childNodes) {
      for (const child of currentNode.childNodes) {
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
    if ('value' in currentNode && typeof currentNode.value === 'string') {
      text += currentNode.value;
    }

    if ('childNodes' in currentNode && currentNode.childNodes) {
      for (const child of currentNode.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return text;
}

/**
 * Helper to get computed styles for an element
 * @param element - Element to get styles for
 * @param elementsMap - Map of elements to their computed styles
 * @returns Computed styles for the element
 */
export function getComputedStyles(
  element: Element,
  elementsMap: Map<Element, CSSProperties>
): CSSProperties {
  return elementsMap.get(element) || {};
}
