import type { INode } from './node-interface';
import type { ParsedNode, Output } from './type';
import { getTextContent, findChildElementsByTagName } from './html-parser';

import { ProjectNode, type ProjectNodeParams } from '../nodes/project';
import { FilesystemNode, type FilesystemNodeParams } from '../nodes/filesystem';
import { YouTubeNode, type YouTubeNodeParams } from '../nodes/youtube';
import { S3Node, type S3NodeParams, type S3PathConfig } from '../nodes/s3';
import { InstagramNode, type InstagramNodeParams } from '../nodes/instagram';
import {
  AIMusicAPINode,
  type AIMusicAPINodeParams,
} from '../nodes/ai_music_api_ai';
import {
  ElevenLabsNode,
  type ElevenLabsNodeParams,
} from '../nodes/elevenlabs';
import { OpenAINode, type OpenAINodeParams } from '../nodes/openai';
import { AppNode, type AppNodeParams } from '../nodes/app';

/**
 * Factory for creating node instances from parsed nodes
 * Extracts parameters from HTML structure and passes them to node constructors
 */
export class NodeFactory {
  /**
   * Creates a node instance based on the parsed node type
   */
  public static createNode(parsedNode: ParsedNode, outputs: Output[] = []): INode {
    switch (parsedNode.type) {
      case 'project':
        return new ProjectNode(this.extractProjectParams(parsedNode, outputs));
      case 'filesystem':
        return new FilesystemNode(this.extractFilesystemParams(parsedNode));
      case 'youtube':
        return new YouTubeNode(this.extractYouTubeParams(parsedNode));
      case 's3':
        return new S3Node(this.extractS3Params(parsedNode));
      case 'instagram':
        return new InstagramNode(this.extractInstagramParams(parsedNode));
      case 'ai_music_api_ai':
        return new AIMusicAPINode(this.extractAIMusicAPIParams(parsedNode));
      case 'elevenlabs':
        return new ElevenLabsNode(this.extractElevenLabsParams(parsedNode));
      case 'openai':
        return new OpenAINode(this.extractOpenAIParams(parsedNode));
      case 'app':
        return new AppNode(this.extractAppParams(parsedNode));
      default:
        throw new Error(`Unknown node type: ${parsedNode.type}`);
    }
  }

  /**
   * Creates node instances for all parsed nodes
   */
  public static createNodes(parsedNodes: ParsedNode[], outputs: Output[] = []): INode[] {
    return parsedNodes.map((parsedNode) => this.createNode(parsedNode, outputs));
  }

  /**
   * Checks if a node type is supported
   */
  public static isSupportedNodeType(nodeType: string): boolean {
    return [
      'project',
      'filesystem',
      'youtube',
      's3',
      'instagram',
      'ai_music_api_ai',
      'elevenlabs',
      'openai',
      'app',
    ].includes(nodeType);
  }

  // Parameter extraction methods

  private static extractProjectParams(
    parsedNode: ParsedNode,
    outputs: Output[],
  ): ProjectNodeParams {
    const content = parsedNode.projectContent;
    if (!content) {
      throw new Error('Project node must have project content');
    }

    return {
      name: parsedNode.name,
      title: content.title,
      tags: content.tags,
      outputs,
      sequences: content.sequences,
      assets: content.assets,
      ffmpegOptions: content.ffmpegOptions,
      css: content.css,
    };
  }

  private static extractFilesystemParams(
    parsedNode: ParsedNode,
  ): FilesystemNodeParams {
    const pathRef = parsedNode.attributes.get('path') || '';
    const pathElements = findChildElementsByTagName(parsedNode.element, 'path');
    const destinationPath =
      pathElements.length > 0
        ? getTextContent(pathElements[0]).trim()
        : '';

    return {
      name: parsedNode.name,
      pathRef,
      destinationPath,
    };
  }

  private static extractYouTubeParams(
    parsedNode: ParsedNode,
  ): YouTubeNodeParams {
    const pathRef = parsedNode.attributes.get('path') || '';

    // Check for flag elements
    const unlistedElements = findChildElementsByTagName(
      parsedNode.element,
      'unlisted',
    );
    const madeForKidsElements = findChildElementsByTagName(
      parsedNode.element,
      'made-for-kids',
    );

    // Extract category
    const categoryElements = findChildElementsByTagName(
      parsedNode.element,
      'category',
    );
    const category =
      categoryElements.length > 0
        ? categoryElements[0].attribs?.name
        : undefined;

    // Extract language
    const languageElements = findChildElementsByTagName(
      parsedNode.element,
      'language',
    );
    const language =
      languageElements.length > 0
        ? languageElements[0].attribs?.name
        : undefined;

    // Extract thumbnail
    const thumbnailElements = findChildElementsByTagName(
      parsedNode.element,
      'thumbnail',
    );
    const thumbnail =
      thumbnailElements.length > 0
        ? thumbnailElements[0].attribs?.timecode
        : undefined;

    // Extract description
    const preElements = findChildElementsByTagName(parsedNode.element, 'pre');
    const description =
      preElements.length > 0 ? getTextContent(preElements[0]).trim() : undefined;

    return {
      name: parsedNode.name,
      pathRef,
      unlisted: unlistedElements.length > 0,
      madeForKids: madeForKidsElements.length > 0,
      category,
      language,
      thumbnail,
      description,
    };
  }

  private static extractS3Params(parsedNode: ParsedNode): S3NodeParams {
    const pathRef = parsedNode.attributes.get('path') || '';

    // Extract endpoint, region, bucket
    const endpointElements = findChildElementsByTagName(
      parsedNode.element,
      'endpoint',
    );
    const endpoint =
      endpointElements.length > 0
        ? endpointElements[0].attribs?.name || ''
        : '';

    const regionElements = findChildElementsByTagName(
      parsedNode.element,
      'region',
    );
    const region =
      regionElements.length > 0
        ? regionElements[0].attribs?.name || ''
        : '';

    const bucketElements = findChildElementsByTagName(
      parsedNode.element,
      'bucket',
    );
    const bucket =
      bucketElements.length > 0
        ? bucketElements[0].attribs?.name || ''
        : '';

    // Extract paths
    const pathElements = findChildElementsByTagName(
      parsedNode.element,
      'path',
    );
    const paths: S3PathConfig[] = pathElements.map((pathEl) => ({
      name: pathEl.attribs?.name || '',
      path: getTextContent(pathEl).trim(),
    }));

    // Extract acl
    const aclElements = findChildElementsByTagName(parsedNode.element, 'acl');
    const acl =
      aclElements.length > 0 ? aclElements[0].attribs?.name : undefined;

    // Extract thumbnail
    const thumbnailElements = findChildElementsByTagName(
      parsedNode.element,
      'thumbnail',
    );
    const thumbnail =
      thumbnailElements.length > 0
        ? thumbnailElements[0].attribs?.timecode
        : undefined;

    return {
      name: parsedNode.name,
      pathRef,
      endpoint,
      region,
      bucket,
      paths,
      acl,
      thumbnail,
    };
  }

  private static extractInstagramParams(
    parsedNode: ParsedNode,
  ): InstagramNodeParams {
    const urlRef = parsedNode.attributes.get('url') || '';

    // Extract thumbnail
    const thumbnailElements = findChildElementsByTagName(
      parsedNode.element,
      'thumbnail',
    );
    const thumbnail =
      thumbnailElements.length > 0
        ? thumbnailElements[0].attribs?.timecode
        : undefined;

    // Extract caption
    const preElements = findChildElementsByTagName(parsedNode.element, 'pre');
    const caption =
      preElements.length > 0 ? getTextContent(preElements[0]).trim() : undefined;

    return {
      name: parsedNode.name,
      urlRef,
      thumbnail,
      caption,
    };
  }

  private static extractAIMusicAPIParams(
    parsedNode: ParsedNode,
  ): AIMusicAPINodeParams {
    // Extract prompt
    const promptElements = findChildElementsByTagName(
      parsedNode.element,
      'prompt',
    );
    const prompt =
      promptElements.length > 0
        ? getTextContent(promptElements[0]).trim()
        : '';

    // Extract model
    const modelElements = findChildElementsByTagName(
      parsedNode.element,
      'model',
    );
    const model =
      modelElements.length > 0 ? modelElements[0].attribs?.name : undefined;

    return {
      name: parsedNode.name,
      prompt,
      model,
    };
  }

  private static extractElevenLabsParams(
    parsedNode: ParsedNode,
  ): ElevenLabsNodeParams {
    const textRef = parsedNode.attributes.get('text') || '';

    // Extract voice and model if they exist as child elements
    const voiceElements = findChildElementsByTagName(
      parsedNode.element,
      'voice',
    );
    const voice =
      voiceElements.length > 0 ? voiceElements[0].attribs?.name : undefined;

    const modelElements = findChildElementsByTagName(
      parsedNode.element,
      'model',
    );
    const model =
      modelElements.length > 0 ? modelElements[0].attribs?.name : undefined;

    return {
      name: parsedNode.name,
      textRef,
      voice,
      model,
    };
  }

  private static extractOpenAIParams(
    parsedNode: ParsedNode,
  ): OpenAINodeParams {
    // Extract prompt
    const promptElements = findChildElementsByTagName(
      parsedNode.element,
      'prompt',
    );
    const prompt =
      promptElements.length > 0
        ? getTextContent(promptElements[0]).trim()
        : '';

    // Extract model
    const modelElements = findChildElementsByTagName(
      parsedNode.element,
      'model',
    );
    const model =
      modelElements.length > 0 ? modelElements[0].attribs?.name : undefined;

    return {
      name: parsedNode.name,
      prompt,
      model,
    };
  }

  private static extractAppParams(parsedNode: ParsedNode): AppNodeParams {
    // src attribute is required
    const src = parsedNode.attributes.get('src') || '';

    // All other attributes become parameters (except name and src)
    const parameters: Record<string, string> = {};
    for (const [key, value] of parsedNode.attributes.entries()) {
      if (key !== 'src' && key !== 'name') {
        parameters[key] = value;
      }
    }

    return {
      name: parsedNode.name,
      src,
      parameters,
    };
  }
}
