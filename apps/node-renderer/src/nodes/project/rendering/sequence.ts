import { AssetManager } from "./asset-manager";
import {
  calculateFinalValue,
  ExpressionContext,
  TimeData,
} from "./expression-parser";

import {
  AMBIENT,
  FilterBuffer,
  makeStream,
  makeSilentStream,
  makeBlankStream,
  ObjectFitContainOptions,
  PILLARBOX,
  Stream,
  VisualFilter,
} from "./stream";
import { Output, SequenceDefinition, FragmentDebugInfo } from "./types";

function msToTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}\\:${String(m).padStart(2, '0')}\\:${String(s).padStart(2, '0')}`;
}

export class Sequence {
  private time: number = 0; // time is absolute

  private videoStream!: Stream;
  private audioStream!: Stream;
  private debugInfo: FragmentDebugInfo[] = []; // Collect debug info during build

  constructor(
    private buf: FilterBuffer,
    private definition: SequenceDefinition,
    private output: Output,
    private assetManager: AssetManager,
    private expressionContext: ExpressionContext,
    private showTime: boolean = false,
    private timeFormat: 'ms' | 'hms' = 'hms',
  ) {}

  build() {
    let firstOne = true;
    this.definition.fragments.forEach((fragment) => {
      if (!fragment.enabled) {
        return;
      }

      const calculatedOverlayLeft = calculateFinalValue(
        fragment.overlayLeft,
        this.expressionContext,
      );

      const calculatedDuration = calculateFinalValue(
        fragment.duration,
        this.expressionContext,
      );

      const calculatedTrimLeft = calculateFinalValue(
        fragment.trimLeft,
        this.expressionContext,
      );

      const asset = this.assetManager.getAssetByName(fragment.assetName);
      if (!asset) {
        return;
      }

      // If fragment duration is 0 (not explicitly set), use asset's natural duration
      // This prevents creating null sources with duration=0ms which causes FFmpeg to hang
      const effectiveDuration = calculatedDuration > 0 ? calculatedDuration : asset.duration;

      const timeContext: TimeData = {
        start: 0,
        end: 0,
        duration: effectiveDuration,
      };

      // Create video stream: use actual video if available, otherwise create blank stream
      let currentVideoStream: Stream;
      if (asset.hasVideo) {
        currentVideoStream = makeStream(
          this.assetManager.getVideoInputLabelByAssetName(fragment.assetName),
          this.buf,
        );
      } else {
        // Create blank transparent video stream for audio-only assets
        // If effectiveDuration is 0, don't create a synthetic stream with 0 duration
        // Instead, FFmpeg will use the audio stream's duration automatically
        if (effectiveDuration > 0) {
          currentVideoStream = makeBlankStream(
            effectiveDuration,
            this.output.resolution.width,
            this.output.resolution.height,
            this.output.fps,
            this.buf,
          );
        } else {
          // For audio-only assets with unknown duration, create a long blank stream
          // and let FFmpeg trim it to match the audio duration
          currentVideoStream = makeBlankStream(
            asset.duration || 10000, // Default to 10 seconds if unknown
            this.output.resolution.width,
            this.output.resolution.height,
            this.output.fps,
            this.buf,
          );
        }
      }

      // Create audio stream: use actual audio if available, otherwise create silent stream
      // If fragment has -sound: off, always use silence
      let currentAudioStream: Stream;
      if (fragment.sound === "off") {
        // Force silent audio when -sound: off
        if (effectiveDuration > 0) {
          currentAudioStream = makeSilentStream(effectiveDuration, this.buf);
        } else {
          currentAudioStream = makeSilentStream(asset.duration || 10000, this.buf);
        }
      } else if (asset.hasAudio) {
        currentAudioStream = makeStream(
          this.assetManager.getAudioInputLabelByAssetName(fragment.assetName),
          this.buf,
        );
      } else {
        // Create silent audio stream matching the video duration
        // If effectiveDuration is 0, don't create a synthetic stream with 0 duration
        if (effectiveDuration > 0) {
          currentAudioStream = makeSilentStream(effectiveDuration, this.buf);
        } else {
          // For video-only assets with unknown duration, create a long silent stream
          // and let FFmpeg trim it to match the video duration
          currentAudioStream = makeSilentStream(asset.duration || 10000, this.buf);
        }
      }

      if ((calculatedTrimLeft != 0 || (effectiveDuration < asset.duration && effectiveDuration > 0))) {
        // Only trim video if it came from an actual source
        if (asset.hasVideo && effectiveDuration > 0) {
          currentVideoStream.trim(
            calculatedTrimLeft,
            calculatedTrimLeft + effectiveDuration,
          );
        }

        // Only trim audio if it came from an actual source AND sound is not off
        if (asset.hasAudio && fragment.sound !== "off" && effectiveDuration > 0) {
          currentAudioStream.trim(
            calculatedTrimLeft,
            calculatedTrimLeft + effectiveDuration,
          );
        }
      }

      // Convert deprecated JPEG pixel format (yuvj420p) to standard yuv420p early
      // This prevents swscaler warnings from appearing in all subsequent filters
      // For PNG/APNG images with alpha, use yuva420p to preserve transparency
      if (asset.hasVideo && asset.type === "image") {
        const hasAlpha = asset.path.toLowerCase().match(/\.(png|apng)$/);
        currentVideoStream.convertPixelFormat(hasAlpha ? "yuva420p" : "yuv420p");
      }

      // Apply visual filter early for static images (before padding/cloning)
      // This is more efficient as ffmpeg processes the filter once, then clones the filtered frame
      if (asset.hasVideo && asset.type === "image" && fragment.visualFilter) {
        currentVideoStream.filter(fragment.visualFilter as VisualFilter);
      }

      if (
        asset.duration === 0 &&
        effectiveDuration > 0 &&
        asset.type === "image" &&
        !asset.path.toLowerCase().endsWith(".apng") &&
        fragment.objectFit !== "ken-burns"
      ) {
        // special case for static images (PNG, JPG, etc) - extend to desired duration
        // APNG files are animated and should NOT be cloned
        // Skip tpad for Ken Burns - zoompan will generate the frames
        currentVideoStream.tPad({
          start: effectiveDuration,
          startMode: "clone",
        });
      }

      // stream normalization (only for actual video, not synthetic blank video)
      if (asset.hasVideo) {
        // fps reduction
        currentVideoStream.fps(this.output.fps);

        // fitting the video stream into the output frame
        if (fragment.objectFit === "ken-burns") {
          // Ken Burns effect (zoom/pan)
          currentVideoStream.kenBurns({
            effect: fragment.objectFitKenBurns,
            zoom: fragment.objectFitKenBurnsZoom,
            effectDuration: fragment.objectFitKenBurnsEffectDuration,
            fragmentDuration: effectiveDuration,
            easing: fragment.objectFitKenBurnsEasing,
            width: this.output.resolution.width,
            height: this.output.resolution.height,
            fps: this.output.fps,
            focalX: fragment.objectFitKenBurnsFocalX,
            focalY: fragment.objectFitKenBurnsFocalY,
            panStartX: fragment.objectFitKenBurnsPanStartX,
            panStartY: fragment.objectFitKenBurnsPanStartY,
            panEndX: fragment.objectFitKenBurnsPanEndX,
            panEndY: fragment.objectFitKenBurnsPanEndY,
          });
        } else if (fragment.objectFit === "cover") {
          currentVideoStream.fitOutputCover(this.output.resolution);
        } else {
          const options: ObjectFitContainOptions = {};
          if (fragment.objectFitContain === AMBIENT) {
            options.ambient = {
              blurStrength: fragment.objectFitContainAmbientBlurStrength,
              brightness: fragment.objectFitContainAmbientBrightness,
              saturation: fragment.objectFitContainAmbientSaturation,
            };
          } else if (fragment.objectFitContain === PILLARBOX) {
            // For PNG/APNG files with alpha, use transparent padding instead of black
            const isPngWithAlpha = asset.path
              .toLowerCase()
              .match(/\.(png|apng)$/);
            const pillarboxColor = isPngWithAlpha
              ? "#00000000"
              : fragment.objectFitContainPillarboxColor;

            options.pillarbox = {
              color: pillarboxColor,
            };
          }
          currentVideoStream.fitOutputContain(this.output.resolution, options);
        }
      }

      // adding effects if needed (only for actual video, not synthetic blank video)
      if (asset.hasVideo) {
        // chromakey
        if (fragment.chromakey) {
          currentVideoStream.chromakey({
            blend: fragment.chromakeyBlend,
            similarity: fragment.chromakeySimilarity,
            color: fragment.chromakeyColor,
          });
        }

        // visual filter (for video assets - images are filtered earlier before padding)
        if (fragment.visualFilter && asset.type !== "image") {
          currentVideoStream.filter(fragment.visualFilter as VisualFilter);
        }
      }

      // transitions
      if (fragment.transitionIn === "fade-in") {
        currentVideoStream.fade({
          fades: [
            {
              type: "in",
              startTime: 0,
              duration: fragment.transitionInDuration,
            },
          ],
        });
        currentAudioStream.fade({
          fades: [
            {
              type: "in",
              startTime: 0,
              duration: fragment.transitionInDuration,
            },
          ],
        });
      }
      if (fragment.transitionOut === "fade-out") {
        currentVideoStream.fade({
          fades: [
            {
              type: "out",
              startTime: effectiveDuration - fragment.transitionOutDuration,
              duration: fragment.transitionOutDuration,
            },
          ],
        });
        currentAudioStream.fade({
          fades: [
            {
              type: "out",
              startTime: effectiveDuration - fragment.transitionOutDuration,
              duration: fragment.transitionOutDuration,
            },
          ],
        });
      }

      // per-fragment time label overlay
      if (this.showTime && asset.hasVideo) {
        const fragmentStart = this.time + calculatedOverlayLeft;
        const fragmentEnd = fragmentStart + effectiveDuration;
        const rangeLabel = `${fragment.assetName}  [${msToTimecode(fragmentStart)} - ${msToTimecode(fragmentEnd)}]`;
        const timeExpr = this.timeFormat === 'ms' ? '%{eif\\:t*1000\\:d}ms' : '%{pts\\:hms}';
        currentVideoStream.drawTimecode(rangeLabel, { y: 50, fontsize: 20, fontcolor: 'yellow' });
        currentVideoStream.drawTimecode(timeExpr, { y: 80, fontsize: 20 });
      }

      // merging to the main streams
      if (!firstOne) {
        // attach current streams to the main ones, depending on the stated overlap
        if (calculatedOverlayLeft === 0) {
          // just concat with the previous one, faster
          this.videoStream.concatStream(currentVideoStream);
          this.audioStream.concatStream(currentAudioStream);
        } else {
          const otherStreamOffsetLeft = this.time + calculatedOverlayLeft;

          // use overlay
          this.videoStream.overlayStream(currentVideoStream, {
            flipLayers: fragment.overlayZIndex < 0,
            offset: {
              streamDuration: this.time,
              otherStreamDuration: effectiveDuration,
              otherStreamOffsetLeft: otherStreamOffsetLeft,
            },
          });
          this.audioStream.overlayStream(currentAudioStream, {
            offset: {
              streamDuration: this.time,
              otherStreamDuration: effectiveDuration,
              otherStreamOffsetLeft: otherStreamOffsetLeft,
            },
          });
        }
      } else {
        // here an overlay can only be positive
        if (calculatedOverlayLeft > 0) {
          // padding video with a transparent fragment
          currentVideoStream.tPad({
            start: calculatedOverlayLeft,
            startMode: "add",
            color: "#00000000",
          });
          // padding audio with a slient fragment
          currentAudioStream.tPad({
            start: calculatedOverlayLeft,
          });
        } else if (calculatedOverlayLeft < 0) {
          throw new Error(
            "overlay cannot be negative for the first fragment in a sequence (fragment id = " +
              fragment.id +
              ")",
          );
        }

        this.videoStream = currentVideoStream;
        this.audioStream = currentAudioStream;
      }

      timeContext.start = this.time + calculatedOverlayLeft;
      timeContext.end = this.time + effectiveDuration + calculatedOverlayLeft;
      this.time += effectiveDuration + calculatedOverlayLeft;

      this.expressionContext.fragments.set(fragment.id, {
        time: timeContext,
      });

      // Collect debug info
      this.debugInfo.push({
        id: fragment.id,
        assetName: fragment.assetName,
        startTime: timeContext.start,
        endTime: timeContext.end,
        duration: effectiveDuration,
        trimLeft: calculatedTrimLeft,
        overlayLeft: calculatedOverlayLeft,
        enabled: fragment.enabled,
      });

      firstOne = false;
    });
  }

  isEmpty() {
    return !this.definition.fragments.some((fragment) => {
      if (!fragment.enabled) {
        return false;
      }
      // Check if fragment has a valid asset
      const asset = this.assetManager.getAssetByName(fragment.assetName);
      return !!asset;
    });
  }

  overlayWith(sequence: Sequence) {
    // DON'T pass offset to overlayStream!
    // The first fragment of the overlaying sequence already has tPad applied in sequence.build()
    // (see lines 290-300 where we apply tPad for firstOne with calculatedOverlayLeft > 0)
    // Passing offset here would apply tPad TWICE, doubling the delay!
    this.videoStream.overlayStream(sequence.getVideoStream(), {});
    this.audioStream.overlayStream(sequence.getAudioStream(), {});
  }

  public getVideoStream(): Stream {
    return this.videoStream;
  }

  public getAudioStream(): Stream {
    return this.audioStream;
  }

  public getDebugInfo(): FragmentDebugInfo[] {
    return this.debugInfo;
  }

  public getTotalDuration(): number {
    return this.time;
  }
}
