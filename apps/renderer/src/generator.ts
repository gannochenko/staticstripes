import { ProjectStructure, Sequence, Fragment } from './type';
import { StreamDAG } from './dag';
import { StreamUtils } from './stream-builder';

export function generateFilterComplex(project: ProjectStructure): string {
  const dag = buildDAG(project);
  return dag.render();
}

/**
 * Collects all unique asset names used in video sequences
 */
function collectUsedAssets(project: ProjectStructure): Set<string> {
  const usedAssets = new Set<string>();

  for (const sequence of project.sequences) {
    for (const fragment of sequence.fragments) {
      if (fragment.assetName) {
        usedAssets.add(fragment.assetName);
      }
    }
  }

  return usedAssets;
}

/**
 * Normalizes assets that are actually used (rotation correction, scaling, fps)
 * Returns a map of asset name -> normalized stream label
 */
function normalizeAssets(
  dag: StreamDAG,
  project: ProjectStructure,
): Map<string, string> {
  const normalized = new Map<string, string>();
  const outputWidth = project.output.resolution.width;
  const outputHeight = project.output.resolution.height;
  const outputFps = project.output.fps;

  // Only normalize assets that are actually used in fragments
  const usedAssets = collectUsedAssets(project);

  for (const assetName of usedAssets) {
    const asset = project.assets.get(assetName);
    if (!asset) {
      console.warn(`Asset "${assetName}" referenced but not found`);
      continue;
    }

    // Skip audio-only assets
    if (asset.type === 'audio') {
      continue;
    }

    const inputIndex = project.assetIndexMap.get(assetName);
    if (inputIndex === undefined) {
      continue;
    }

    // Normalize: rotation -> scale (cover) -> fps
    // Using 'cover' mode: scales to fill while preserving aspect ratio, crops overflow
    const normalizedStream = dag
      .from(`${inputIndex}:v`)
      .correctRotation(asset.rotation)
      .scaleCover(outputWidth, outputHeight)
      .fps(outputFps);

    normalized.set(assetName, normalizedStream.getLooseLabel());
  }

  return normalized;
}

/**
 * Builds the StreamDAG from a project structure
 * Exposed for debugging and analysis
 */
export function buildDAG(project: ProjectStructure): StreamDAG {
  if (project.sequences.length === 0) {
    return new StreamDAG();
  }

  const dag = new StreamDAG();

  // Normalize all assets upfront (rotation, scale, fps)
  const normalizedAssets = normalizeAssets(dag, project);

  // Filter out audio-only sequences (sequences where all assets are audio-only)
  const videoSequences = project.sequences.filter((sequence) => {
    return sequence.fragments.some((fragment) => {
      const asset = project.assets.get(fragment.assetName);
      // Include if asset has video (video or image)
      return asset && (asset.type === 'video' || asset.type === 'image');
    });
  });

  if (videoSequences.length === 0) {
    console.warn('No video sequences found in project');
    return new StreamDAG();
  }

  // Process each video sequence
  const sequenceOutputs: string[] = [];
  for (let seqIdx = 0; seqIdx < videoSequences.length; seqIdx++) {
    const sequence = videoSequences[seqIdx];
    const outputLabel = dag.makeLabel();

    const output = generateSequenceGraph(
      dag,
      sequence,
      normalizedAssets,
      outputLabel,
    );
    sequenceOutputs.push(output);
  }

  // Connect all sequences with concat
  if (sequenceOutputs.length === 1) {
    // Single sequence, just copy to output
    dag.from(sequenceOutputs[0]).copyTo('outv');
  } else {
    // Multiple sequences, concat them in time
    const streams = sequenceOutputs.map((label) => dag.from(label));
    StreamUtils.concatTo(dag, streams, 'outv');
  }

  return dag;
}

/**
 * Generates filter graph for a single sequence
 */
function generateSequenceGraph(
  dag: StreamDAG,
  sequence: Sequence,
  normalizedAssets: Map<string, string>,
  outputLabel: string,
): string {
  const { fragments } = sequence;

  if (fragments.length === 0) {
    return outputLabel;
  }

  if (fragments.length === 1) {
    // Single fragment, just copy it
    const fragment = fragments[0];
    const normalizedLabel = normalizedAssets.get(fragment.assetName);
    if (!normalizedLabel) {
      console.warn(`Normalized asset not found: ${fragment.assetName}`);
      return outputLabel;
    }
    dag.from(normalizedLabel).copyTo(outputLabel);
    return outputLabel;
  }

  // Check if we can use simple concat for all (no overlaps anywhere)
  const hasOverlaps = fragments.some((frag) => frag.overlayLeft !== 0);

  if (!hasOverlaps) {
    // Use concat filter for everything (faster)
    buildConcatGraph(dag, fragments, normalizedAssets, outputLabel);
  } else {
    // Mix of overlapping and non-overlapping: use hybrid approach
    buildHybridGraph(dag, fragments, normalizedAssets, outputLabel);
  }

  return outputLabel;
}

/**
 * Builds a graph with a single concat filter for all fragments
 * Uses pre-normalized assets
 */
function buildConcatGraph(
  dag: StreamDAG,
  fragments: Fragment[],
  normalizedAssets: Map<string, string>,
  outputLabel: string,
): void {
  const streams = fragments
    .map((frag) => {
      const normalizedLabel = normalizedAssets.get(frag.assetName);
      if (!normalizedLabel) {
        console.warn(`Normalized asset not found: ${frag.assetName}`);
        return null;
      }
      return dag.from(normalizedLabel);
    })
    .filter((s) => s !== null);

  StreamUtils.concatTo(dag, streams, outputLabel);
}

/**
 * Builds a hybrid graph: concat for non-overlapping prefix, xfade for the rest
 * Uses pre-normalized assets
 */
function buildHybridGraph(
  dag: StreamDAG,
  fragments: Fragment[],
  normalizedAssets: Map<string, string>,
  outputLabel: string,
): void {
  // Find the longest prefix of consecutive non-overlapping fragments
  let concatEnd = 0;
  for (let i = 0; i < fragments.length - 1; i++) {
    const hasOverlap = fragments[i + 1].overlayLeft !== 0;
    if (hasOverlap) {
      break;
    }
    concatEnd = i + 1;
  }

  let currentStream;
  let timeOffset = 0;
  let nextFragmentIndex = 0;

  // If we have 2+ non-overlapping fragments at the start, concat them
  if (concatEnd >= 1) {
    const streams = [];
    for (let i = 0; i <= concatEnd; i++) {
      const normalizedLabel = normalizedAssets.get(fragments[i].assetName);
      if (!normalizedLabel) {
        console.warn(`Normalized asset not found: ${fragments[i].assetName}`);
        continue;
      }
      streams.push(dag.from(normalizedLabel));
      timeOffset += fragments[i].duration;
    }
    currentStream = StreamUtils.concat(dag, streams);
    nextFragmentIndex = concatEnd + 1;
  } else {
    // Start with first fragment
    const normalizedLabel = normalizedAssets.get(fragments[0].assetName);
    if (!normalizedLabel) {
      console.warn(`Normalized asset not found: ${fragments[0].assetName}`);
      return;
    }
    currentStream = dag.from(normalizedLabel);
    timeOffset = fragments[0].duration;
    nextFragmentIndex = 1;
  }

  // Process remaining fragments with xfade
  while (nextFragmentIndex < fragments.length) {
    const currFragment = fragments[nextFragmentIndex];

    // Get normalized asset stream
    const normalizedLabel = normalizedAssets.get(currFragment.assetName);
    if (!normalizedLabel) {
      console.warn(`Normalized asset not found: ${currFragment.assetName}`);
      nextFragmentIndex++;
      continue;
    }
    const nextStream = dag.from(normalizedLabel);

    // Adjust offset for overlap
    timeOffset += currFragment.overlayLeft;

    const isLast = nextFragmentIndex === fragments.length - 1;
    const transitionDuration = Math.abs(currFragment.overlayLeft) / 1000;

    if (isLast) {
      // Last fragment - output to final label
      currentStream = currentStream.xfadeTo(nextStream, outputLabel, {
        duration: transitionDuration,
        offset: timeOffset / 1000,
      });
    } else {
      // Intermediate fragment - auto-generate label
      currentStream = currentStream.xfade(nextStream, {
        duration: transitionDuration,
        offset: timeOffset / 1000,
      });
    }

    timeOffset += currFragment.duration;
    nextFragmentIndex++;
  }
}
