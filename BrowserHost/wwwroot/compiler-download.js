import { parts } from "./runtime-bundle.js";

const cacheName = "csharp-onboarding-compiler-v1";
const idleLimit = 40000;

async function readDownload(url, expectedSize, signal, report) {
  const attempt = new AbortController();
  const requestSignal = AbortSignal.any([signal, attempt.signal]);
  let idle;

  function resetIdle() {
    clearTimeout(idle);
    idle = setTimeout(() => attempt.abort(new Error("Download stalled")), idleLimit);
  }

  try {
    resetIdle();
    const response = await fetch(url, { signal: requestSignal, cache: "no-cache" });
    if (!response.ok)
      throw new Error("HTTP " + response.status);

    let size = 0;
    const stream = response.body.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        size += chunk.byteLength;
        report(size);
        resetIdle();
        controller.enqueue(chunk);
      },
    }));
    const file = await new Response(stream).blob();
    if (expectedSize !== undefined && file.size !== expectedSize)
      throw new Error("Incomplete download");
    return file;
  } finally {
    clearTimeout(idle);
  }
}

export async function downloadCompiler(signal, onProgress) {
  const cache = await globalThis.caches?.open(cacheName).catch(() => undefined);
  const files = [
    ...parts.map(({ name, size }) => ({ path: "./_framework/" + name, size })),
    { path: "./references.zip" },
  ];
  const received = files.map(() => 0);
  let lastReported = 0;

  async function loadFile({ path, size }, index) {
    const url = new URL(path, import.meta.url);
    const cached = await cache?.match(url).catch(() => undefined);
    if (cached) {
      const file = await cached.blob();
      if (size === undefined || file.size === size)
        return file;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      received[index] = 0;
      try {
        const file = await readDownload(url, size, signal, (count) => {
          received[index] = count;
          const total = received.reduce((sum, bytes) => sum + bytes, 0);
          if (total - lastReported >= 128 * 1024) {
            lastReported = total;
            onProgress(total);
          }
        });
        await cache?.put(url, new Response(file)).catch(() => undefined);
        return file;
      } catch (error) {
        signal.throwIfAborted();
        if (attempt === 2)
          throw new Error("The C# compiler download stalled or failed. Press Run C# to retry.");
      }
    }
  }

  const downloads = await Promise.all(files.map(loadFile));
  const references = downloads.pop();
  return { bundle: new Blob(downloads), references };
}
