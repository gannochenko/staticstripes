"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFactory = void 0;
const html_parser_1 = require("./html-parser");
const project_1 = require("../nodes/project");
const filesystem_1 = require("../nodes/filesystem");
const youtube_1 = require("../nodes/youtube");
const s3_1 = require("../nodes/s3");
const instagram_1 = require("../nodes/instagram");
const ai_music_api_ai_1 = require("../nodes/ai_music_api_ai");
const elevenlabs_1 = require("../nodes/elevenlabs");
const openai_1 = require("../nodes/openai");
const app_1 = require("../nodes/app");
/**
 * Factory for creating node instances from parsed nodes
 * Extracts parameters from HTML structure and passes them to node constructors
 */
class NodeFactory {
    /**
     * Creates a node instance based on the parsed node type
     */
    static createNode(parsedNode, outputs = []) {
        switch (parsedNode.type) {
            case 'project':
                return new project_1.ProjectNode(this.extractProjectParams(parsedNode, outputs));
            case 'filesystem':
                return new filesystem_1.FilesystemNode(this.extractFilesystemParams(parsedNode));
            case 'youtube':
                return new youtube_1.YouTubeNode(this.extractYouTubeParams(parsedNode));
            case 's3':
                return new s3_1.S3Node(this.extractS3Params(parsedNode));
            case 'instagram':
                return new instagram_1.InstagramNode(this.extractInstagramParams(parsedNode));
            case 'ai_music_api_ai':
                return new ai_music_api_ai_1.AIMusicAPINode(this.extractAIMusicAPIParams(parsedNode));
            case 'elevenlabs':
                return new elevenlabs_1.ElevenLabsNode(this.extractElevenLabsParams(parsedNode));
            case 'openai':
                return new openai_1.OpenAINode(this.extractOpenAIParams(parsedNode));
            case 'app':
                return new app_1.AppNode(this.extractAppParams(parsedNode));
            default:
                throw new Error(`Unknown node type: ${parsedNode.type}`);
        }
    }
    /**
     * Creates node instances for all parsed nodes
     */
    static createNodes(parsedNodes, outputs = []) {
        return parsedNodes.map((parsedNode) => this.createNode(parsedNode, outputs));
    }
    /**
     * Checks if a node type is supported
     */
    static isSupportedNodeType(nodeType) {
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
    static extractProjectParams(parsedNode, outputs) {
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
    static extractFilesystemParams(parsedNode) {
        const pathRef = parsedNode.attributes.get('path') || '';
        const pathElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'path');
        const destinationPath = pathElements.length > 0
            ? (0, html_parser_1.getTextContent)(pathElements[0]).trim()
            : '';
        return {
            name: parsedNode.name,
            pathRef,
            destinationPath,
        };
    }
    static extractYouTubeParams(parsedNode) {
        const pathRef = parsedNode.attributes.get('path') || '';
        // Check for flag elements
        const unlistedElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'unlisted');
        const madeForKidsElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'made-for-kids');
        // Extract category
        const categoryElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'category');
        const category = categoryElements.length > 0
            ? categoryElements[0].attribs?.name
            : undefined;
        // Extract language
        const languageElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'language');
        const language = languageElements.length > 0
            ? languageElements[0].attribs?.name
            : undefined;
        // Extract thumbnail
        const thumbnailElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'thumbnail');
        const thumbnail = thumbnailElements.length > 0
            ? thumbnailElements[0].attribs?.timecode
            : undefined;
        // Extract description
        const preElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'pre');
        const description = preElements.length > 0 ? (0, html_parser_1.getTextContent)(preElements[0]).trim() : undefined;
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
    static extractS3Params(parsedNode) {
        const pathRef = parsedNode.attributes.get('path') || '';
        // Extract endpoint, region, bucket
        const endpointElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'endpoint');
        const endpoint = endpointElements.length > 0
            ? endpointElements[0].attribs?.name || ''
            : '';
        const regionElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'region');
        const region = regionElements.length > 0
            ? regionElements[0].attribs?.name || ''
            : '';
        const bucketElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'bucket');
        const bucket = bucketElements.length > 0
            ? bucketElements[0].attribs?.name || ''
            : '';
        // Extract paths
        const pathElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'path');
        const paths = pathElements.map((pathEl) => ({
            name: pathEl.attribs?.name || '',
            path: (0, html_parser_1.getTextContent)(pathEl).trim(),
        }));
        // Extract acl
        const aclElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'acl');
        const acl = aclElements.length > 0 ? aclElements[0].attribs?.name : undefined;
        // Extract thumbnail
        const thumbnailElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'thumbnail');
        const thumbnail = thumbnailElements.length > 0
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
    static extractInstagramParams(parsedNode) {
        const urlRef = parsedNode.attributes.get('url') || '';
        // Extract thumbnail
        const thumbnailElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'thumbnail');
        const thumbnail = thumbnailElements.length > 0
            ? thumbnailElements[0].attribs?.timecode
            : undefined;
        // Extract caption
        const preElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'pre');
        const caption = preElements.length > 0 ? (0, html_parser_1.getTextContent)(preElements[0]).trim() : undefined;
        return {
            name: parsedNode.name,
            urlRef,
            thumbnail,
            caption,
        };
    }
    static extractAIMusicAPIParams(parsedNode) {
        // Extract prompt
        const promptElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'prompt');
        const prompt = promptElements.length > 0
            ? (0, html_parser_1.getTextContent)(promptElements[0]).trim()
            : '';
        // Extract model
        const modelElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'model');
        const model = modelElements.length > 0 ? modelElements[0].attribs?.name : undefined;
        return {
            name: parsedNode.name,
            prompt,
            model,
        };
    }
    static extractElevenLabsParams(parsedNode) {
        const textRef = parsedNode.attributes.get('text') || '';
        // Extract voice and model if they exist as child elements
        const voiceElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'voice');
        const voice = voiceElements.length > 0 ? voiceElements[0].attribs?.name : undefined;
        const modelElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'model');
        const model = modelElements.length > 0 ? modelElements[0].attribs?.name : undefined;
        // Extract optional parameters from attributes
        const outputFormat = parsedNode.attributes.get('outputFormat');
        const stabilityStr = parsedNode.attributes.get('stability');
        const stability = stabilityStr ? parseFloat(stabilityStr) : undefined;
        const similarityBoostStr = parsedNode.attributes.get('similarityBoost');
        const similarityBoost = similarityBoostStr ? parseFloat(similarityBoostStr) : undefined;
        const styleStr = parsedNode.attributes.get('style');
        const style = styleStr ? parseFloat(styleStr) : undefined;
        const useSpeakerBoostStr = parsedNode.attributes.get('useSpeakerBoost');
        const useSpeakerBoost = useSpeakerBoostStr ? useSpeakerBoostStr === 'true' : undefined;
        const salt = parsedNode.attributes.get('salt');
        return {
            name: parsedNode.name,
            textRef,
            voice,
            model,
            outputFormat,
            stability,
            similarityBoost,
            style,
            useSpeakerBoost,
            salt,
        };
    }
    static extractOpenAIParams(parsedNode) {
        // Extract prompt
        const promptElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'prompt');
        const prompt = promptElements.length > 0
            ? (0, html_parser_1.getTextContent)(promptElements[0]).trim()
            : '';
        // Extract model
        const modelElements = (0, html_parser_1.findChildElementsByTagName)(parsedNode.element, 'model');
        const model = modelElements.length > 0 ? modelElements[0].attribs?.name : undefined;
        // Extract maxTokens from attributes
        const maxTokensStr = parsedNode.attributes.get('maxTokens');
        const maxTokens = maxTokensStr ? parseInt(maxTokensStr, 10) : undefined;
        // Extract temperature from attributes
        const temperatureStr = parsedNode.attributes.get('temperature');
        const temperature = temperatureStr ? parseFloat(temperatureStr) : undefined;
        // Extract salt from attributes
        const salt = parsedNode.attributes.get('salt');
        return {
            name: parsedNode.name,
            prompt,
            model,
            maxTokens,
            temperature,
            salt,
        };
    }
    static extractAppParams(parsedNode) {
        // src attribute is required
        const src = parsedNode.attributes.get('src') || '';
        // All other attributes become parameters (except name and src)
        const parameters = {};
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
exports.NodeFactory = NodeFactory;
//# sourceMappingURL=node-factory.js.map