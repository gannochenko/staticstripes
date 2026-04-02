import type { Element, AnyNode } from 'domhandler';
import { ParsedProject } from './type';
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
export declare class HTMLParser {
    /**
     * Parses an HTML file into a ParsedProject
     * @param filePath - Absolute or relative path to the HTML file
     * @returns Promise resolving to the parsed project
     */
    parseFile(filePath: string): Promise<ParsedProject>;
    /**
     * Parses HTML string into a ParsedProject
     * @param html - HTML string to parse
     * @returns The parsed project with nodes
     */
    parse(html: string): ParsedProject;
    /**
     * Traverses the AST and extracts all node elements
     */
    private traverseAndExtractNodes;
    /**
     * Extracts a node from an element
     */
    private extractNode;
    /**
     * Parses the content of a project node
     */
    private parseProjectContent;
    /**
     * Extracts title from project element
     */
    private extractTitle;
    /**
     * Extracts tags from project element
     */
    private extractTags;
    /**
     * Extracts CSS text from <style> elements
     */
    private extractCSS;
    /**
     * Builds a map of CSS rules from the parsed CSS AST
     */
    private buildStyleRules;
    /**
     * Applies CSS rules to all elements in a tree
     */
    private applyStylesToElement;
    /**
     * Checks if an element matches a CSS selector (simplified implementation)
     */
    private matchesSelector;
    /**
     * Extracts base paths from <basePaths> section
     */
    private extractBasePaths;
    /**
     * Extracts assets from <assets> section
     */
    private extractAssets;
    /**
     * Extracts outputs from top-level <outputs> element
     */
    private extractOutputs;
    /**
     * Extracts sequences from <sequences> section
     */
    private extractSequences;
    /**
     * Extracts FFmpeg options from <ffmpeg> section
     */
    private extractFFmpegOptions;
    /**
     * Finds all descendant elements with a specific tag name (recursive)
     */
    private findDescendantsByTagName;
    /**
     * Extracts attributes from an element as a Map
     */
    private getAttributes;
    /**
     * Gets direct child elements of a node
     */
    private getChildElements;
}
/**
 * Helper to get text content from a node
 * @param node - Node to extract text from
 * @returns Concatenated text content
 */
export declare function getTextContent(node: AnyNode): string;
/**
 * Helper to find child elements by tag name
 * @param element - Parent element to search in
 * @param tagName - Tag name to search for
 * @returns Array of matching child elements
 */
export declare function findChildElementsByTagName(element: Element, tagName: string): Element[];
//# sourceMappingURL=html-parser.d.ts.map