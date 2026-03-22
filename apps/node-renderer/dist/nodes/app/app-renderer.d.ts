import { Browser } from "puppeteer";
export type App = {
    id: string;
    src: string;
    parameters: Record<string, string>;
};
export type AppRenderResult = {
    app: App;
    mode: "static" | "animated";
    path: string;
    frameCount?: number;
    duration?: number;
    fps?: number;
};
export interface RenderAppOptions {
    app: App;
    width: number;
    height: number;
    projectDir: string;
    outputName: string;
    title: string;
    date?: string;
    tags: string[];
    fps: number;
    duration: number;
    browser?: Browser;
}
/**
 * Renders a React (or any SPA) app using an event-driven approach.
 *
 * The app can emit:
 * - 'sts-capture-frame' events: Request frame capture (for animated apps)
 * - 'sts-done-rendering' event: Signal rendering complete
 *
 * If no frames are captured, produces a static PNG.
 * If frames are captured, merges them into an MP4 video.
 */
export declare function renderApp(options: RenderAppOptions): Promise<AppRenderResult>;
//# sourceMappingURL=app-renderer.d.ts.map