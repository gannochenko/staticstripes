import { Filter, Label, Millisecond } from './ffmpeg';
export declare const PILLARBOX = "pillarbox";
export declare const AMBIENT = "ambient";
type Dimensions = {
    width: number;
    height: number;
};
export declare enum Direction {
    CW = 0,
    CW2 = 1,
    CCW = 2,
    CCW2 = 3
}
export declare enum ChromakeySimilarity {
    Strict = 0.1,
    Good = 0.3,
    Forgiving = 0.5,
    Loose = 0.7
}
export declare enum ChromakeyBlend {
    Hard = 0,
    Smooth = 0.1,
    Soft = 0.2
}
export declare enum Colors {
    Transparent = "#00000000"
}
export declare enum VisualFilter {
    InstagramClarendon = "instagram-clarendon",
    InstagramGingham = "instagram-gingham",
    InstagramJuno = "instagram-juno",
    InstagramLark = "instagram-lark",
    InstagramLudwig = "instagram-ludwig",
    InstagramNashville = "instagram-nashville",
    InstagramValencia = "instagram-valencia",
    InstagramXProII = "instagram-xpro2",
    InstagramWillow = "instagram-willow",
    InstagramLoFi = "instagram-lofi",
    InstagramInkwell = "instagram-inkwell",
    InstagramMoon = "instagram-moon",
    InstagramHudson = "instagram-hudson",
    InstagramToaster = "instagram-toaster",
    InstagramWalden = "instagram-walden",
    InstagramRise = "instagram-rise",
    InstagramAmaro = "instagram-amaro",
    InstagramMayfair = "instagram-mayfair",
    InstagramEarlybird = "instagram-earlybird",
    InstagramSutro = "instagram-sutro",
    InstagramAden = "instagram-aden",
    InstagramCrema = "instagram-crema"
}
export type ObjectFitContainOptions = {
    ambient?: {
        blurStrength?: number;
        brightness?: number;
        saturation?: number;
    };
    pillarbox?: {
        color: string;
    };
};
export declare class FilterBuffer {
    private filters;
    append(filter: Filter): void;
    render(): string;
}
export declare function makeStream(label: Label, buf: FilterBuffer): Stream;
export declare function makeSilentStream(duration: Millisecond, buf: FilterBuffer): Stream;
export declare function makeBlankStream(duration: Millisecond, width: number, height: number, fps: number, buf: FilterBuffer): Stream;
export declare class Stream {
    private looseEnd;
    private buf;
    constructor(looseEnd: Label, buf: FilterBuffer);
    trim(start: Millisecond, end: Millisecond): Stream;
    fitOutputSimple(dimensions: Dimensions): Stream;
    fitOutputCover(dimensions: Dimensions): Stream;
    fitOutputContain(dimensions: Dimensions, options?: ObjectFitContainOptions): Stream;
    chromakey(parameters: {
        color: string;
        similarity?: number | ChromakeySimilarity;
        blend?: number | ChromakeyBlend;
    }): Stream;
    kenBurns(parameters: {
        effect: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-top' | 'pan-bottom';
        zoom: number;
        effectDuration: number;
        fragmentDuration: number;
        easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
        width: number;
        height: number;
        fps: number;
        focalX?: number;
        focalY?: number;
        panStartX?: number;
        panStartY?: number;
        panEndX?: number;
        panEndY?: number;
    }): Stream;
    fps(value: number): Stream;
    convertPixelFormat(format: string): Stream;
    blur(strength: number): Stream;
    fade(options: {
        fades: Array<{
            type: 'in' | 'out';
            startTime: Millisecond;
            duration: Millisecond;
            color?: string;
            curve?: string;
        }>;
    }): Stream;
    transpose(value: 0 | 1 | 2 | 3): Stream;
    cwRotate(direction: Direction): Stream;
    concatStream(stream: Stream): Stream;
    concatStreams(streams: Stream[]): Stream;
    mixStream(stream: Stream, options?: {
        duration?: 'longest' | 'shortest' | 'first';
        dropout_transition?: number;
        weights?: number[];
        normalize?: boolean;
    }): Stream;
    mixStreams(streams: Stream[], options?: {
        duration?: 'longest' | 'shortest' | 'first';
        dropout_transition?: number;
        weights?: number[];
        normalize?: boolean;
    }): Stream;
    tPad(options?: {
        start?: Millisecond;
        stop?: Millisecond;
        color?: string;
        startMode?: 'clone' | 'add';
        stopMode?: 'clone' | 'add';
    }): Stream;
    overlayStream(stream: Stream, options: {
        flipLayers?: boolean;
        offset?: {
            streamDuration: number;
            otherStreamDuration: number;
            otherStreamOffsetLeft: number;
        };
    }): Stream;
    endTo(label: Label): Stream;
    /**
     * Applies an Instagram-style filter to the video stream
     * @param filterName - The filter to apply
     */
    filter(filterName: VisualFilter): Stream;
    volume(percent: number): Stream;
    drawTimecode(text: string, options?: {
        x?: string | number;
        y?: string | number;
        fontsize?: number;
        fontcolor?: string;
    }): Stream;
    getLooseEnd(): Label;
    render(): string;
}
export {};
//# sourceMappingURL=stream.d.ts.map