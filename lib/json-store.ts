import crypto from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Serialized, atomic JSON file store with automatic `os.tmpdir()` fallback
 * for read-only deployment filesystems.
 */
export class JsonFileStore<T> {
  private readonly primaryDir: string;
  private readonly primaryFile: string;
  private readonly fallbackDir: string;
  private readonly fallbackFile: string;
  private readonly normalize: (raw: unknown) => T;
  private writeQueue: Promise<unknown> = Promise.resolve();
  private preferFallback = false;

  constructor(options: {
    filename: string;
    fallbackSubdir: string;
    normalize: (raw: unknown) => T;
  }) {
    this.primaryDir = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
    this.primaryFile = path.join(/*turbopackIgnore: true*/ this.primaryDir, options.filename);
    this.fallbackDir = path.join(/*turbopackIgnore: true*/ os.tmpdir(), options.fallbackSubdir);
    this.fallbackFile = path.join(/*turbopackIgnore: true*/ this.fallbackDir, options.filename);
    this.normalize = options.normalize;
  }

  private async readFromPath(filePath: string): Promise<T | null> {
    try {
      const raw = await readFile(/*turbopackIgnore: true*/ filePath, "utf8");
      return this.normalize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async read(): Promise<T> {
    const order = this.preferFallback
      ? [this.fallbackFile, this.primaryFile]
      : [this.primaryFile, this.fallbackFile];

    for (const candidate of order) {
      const data = await this.readFromPath(candidate);
      if (data !== null) return data;
    }

    return this.normalize(null);
  }

  private async write(data: T): Promise<T> {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    const targets = this.preferFallback
      ? [{ dir: this.fallbackDir, file: this.fallbackFile, isFallback: true }]
      : [
          { dir: this.primaryDir, file: this.primaryFile, isFallback: false },
          { dir: this.fallbackDir, file: this.fallbackFile, isFallback: true },
        ];

    let lastError: unknown = null;
    for (const target of targets) {
      const tmp = `${target.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      try {
        await mkdir(/*turbopackIgnore: true*/ target.dir, { recursive: true });
        await writeFile(/*turbopackIgnore: true*/ tmp, serialized, "utf8");
        await rename(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ target.file);
        if (target.isFallback) {
          this.preferFallback = true;
        }
        return data;
      } catch (err) {
        lastError = err;
        await rm(/*turbopackIgnore: true*/ tmp, { force: true }).catch(() => {});
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Could not persist data store.");
  }

  withLock<R>(
    task: (current: T) => Promise<{ next: T; result: R; skipWrite?: boolean }> | { next: T; result: R; skipWrite?: boolean },
  ): Promise<R> {
    const run = this.writeQueue.then(async () => {
      const current = await this.read();
      const { next, result, skipWrite } = await task(current);
      if (!skipWrite) {
        await this.write(next);
      }
      return result;
    });
    this.writeQueue = run.catch(() => undefined);
    return run;
  }
}
