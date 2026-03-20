import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilesystemNode } from './index';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FilesystemNode', () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `node-renderer-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor and getters', () => {
    it('should create a filesystem node with correct properties', () => {
      const node = new FilesystemNode({
        name: 'test_fs',
        pathRef: '$project.output.youtube',
        destinationPath: 'output/video.mp4',
      });

      expect(node.getType()).toBe('filesystem');
      expect(node.getName()).toBe('test_fs');
      expect(node.getPathRef()).toBe('$project.output.youtube');
      expect(node.getDestinationPath()).toBe('output/video.mp4');
    });

    it('should work without a name', () => {
      const node = new FilesystemNode({
        pathRef: '$project.output.youtube',
        destinationPath: 'output/video.mp4',
      });

      expect(node.getName()).toBeUndefined();
    });
  });

  describe('getInputs', () => {
    it('should return path input', () => {
      const node = new FilesystemNode({
        pathRef: '$project.output.youtube',
        destinationPath: 'output/video.mp4',
      });

      const inputs = node.getInputs();
      expect(inputs).toHaveLength(1);
      expect(inputs[0].name).toBe('path');
    });
  });

  describe('getOutputs', () => {
    it('should return file output', () => {
      const node = new FilesystemNode({
        pathRef: '$project.output.youtube',
        destinationPath: 'output/video.mp4',
      });

      const outputs = node.getOutputs();
      expect(outputs).toHaveLength(1);
      expect(outputs[0].name).toBe('file');
    });
  });

  describe('validateParameters', () => {
    it('should validate correct parameters', () => {
      const node = new FilesystemNode({
        pathRef: '$project.output.youtube',
        destinationPath: 'output/video.mp4',
      });

      const errors = node.validateParameters();
      expect(errors).toHaveLength(0);
    });

    it('should detect missing pathRef', () => {
      const node = new FilesystemNode({
        pathRef: '',
        destinationPath: 'output/video.mp4',
      });

      const errors = node.validateParameters();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('pathRef');
    });

    it('should detect missing destinationPath', () => {
      const node = new FilesystemNode({
        pathRef: '$project.output.youtube',
        destinationPath: '',
      });

      const errors = node.validateParameters();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('destinationPath');
    });
  });

  describe('execute', () => {
    it('should copy file from source to destination', async () => {
      // Create source file
      const sourceFile = join(testDir, 'source.mp4');
      const sourceContent = 'test video content';
      writeFileSync(sourceFile, sourceContent);

      // Setup node
      const node = new FilesystemNode({
        pathRef: '$upstream.output.video',
        destinationPath: 'dest/output.mp4',
      });

      // Execute with context
      const result = await node.execute({
        getOutput: (nodeName, outputName) => {
          if (nodeName === 'upstream' && outputName === 'video') {
            return sourceFile;
          }
          return undefined;
        },
        projectDir: testDir,
      });

      // Verify file was copied
      const destFile = join(testDir, 'dest/output.mp4');
      expect(existsSync(destFile)).toBe(true);
      expect(readFileSync(destFile, 'utf-8')).toBe(sourceContent);

      // Verify output
      expect(result.file).toBe(destFile);
    });

    it('should create destination directory if it doesn\'t exist', async () => {
      // Create source file
      const sourceFile = join(testDir, 'source.mp4');
      writeFileSync(sourceFile, 'content');

      const node = new FilesystemNode({
        pathRef: '$upstream.output.video',
        destinationPath: 'nested/deep/path/output.mp4',
      });

      await node.execute({
        getOutput: () => sourceFile,
        projectDir: testDir,
      });

      // Verify nested directory was created
      const destFile = join(testDir, 'nested/deep/path/output.mp4');
      expect(existsSync(destFile)).toBe(true);
    });

    it('should throw error for invalid pathRef format', async () => {
      const node = new FilesystemNode({
        pathRef: 'invalid-reference', // Missing $ and output
        destinationPath: 'output.mp4',
      });

      await expect(
        node.execute({
          getOutput: () => undefined,
          projectDir: testDir,
        }),
      ).rejects.toThrow('Invalid path reference format');
    });

    it('should throw error when upstream output not found', async () => {
      const node = new FilesystemNode({
        pathRef: '$upstream.output.video',
        destinationPath: 'output.mp4',
      });

      await expect(
        node.execute({
          getOutput: () => undefined, // No output available
          projectDir: testDir,
        }),
      ).rejects.toThrow('Could not get output');
    });
  });

  describe('getParameterSchema', () => {
    it('should return correct schema', () => {
      const node = new FilesystemNode({
        pathRef: '$project.output.youtube',
        destinationPath: 'output/video.mp4',
      });

      const schema = node.getParameterSchema();
      expect(schema).toHaveLength(2);

      const pathRefParam = schema.find((p) => p.name === 'pathRef');
      expect(pathRefParam?.required).toBe(true);
      expect(pathRefParam?.type).toBe('reference');

      const destPathParam = schema.find((p) => p.name === 'destinationPath');
      expect(destPathParam?.required).toBe(true);
      expect(destPathParam?.type).toBe('string');
    });
  });
});
