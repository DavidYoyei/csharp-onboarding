import { dotnet } from "./_framework/dotnet.js";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function openRegistry() {
  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle("csharp-onboarding", { create: true });
  const file = await folder.getFileHandle("students.txt", { create: true });
  return file.createSyncAccessHandle();
}

function readLine(buffer, unavailable) {
  if (!buffer)
    throw new Error(unavailable);

  const state = new Int32Array(buffer, 0, 2);
  postMessage({ type: "input" });
  // This runs off the UI thread, so Console.ReadLine can wait for an actual line.
  while (Atomics.load(state, 0) === 0)
    Atomics.wait(state, 0, 0);

  const size = Atomics.load(state, 1);
  const text = decoder.decode(new Uint8Array(buffer, 8, size).slice());
  Atomics.store(state, 0, 0);
  return text;
}

self.addEventListener("message", async ({ data }) => {
  let file;
  try {
    const response = fetch("./references.zip", { cache: "force-cache" });
    const { setModuleImports, getAssemblyExports, getConfig } = await dotnet.create();
    const archive = await response;
    if (!archive.ok)
      throw new Error("The C# reference files could not be loaded.");
    const exports = await getAssemblyExports(getConfig().mainAssemblyName);
    exports.Program.LoadReferences(new Uint8Array(await archive.arrayBuffer()));

    let initial = null;
    if (data.registry) {
      try {
        file = await openRegistry();
      } catch {
        throw new Error("Could not open students.txt. Close other registry runs and check browser storage access.");
      }
      if (file.getSize() > 1_000_000)
        throw new Error("The students.txt demo file exceeds the 1 MB limit.");
      const bytes = new Uint8Array(file.getSize());
      const count = file.read(bytes, { at: 0 });
      initial = decoder.decode(bytes.subarray(0, count));
      postMessage({ type: "registry", text: initial });
    }

    setModuleImports("consoleBridge", {
      write(text) {
        postMessage({ type: "output", text });
      },
      readLine() {
        return readLine(data.buffer, data.isolationError);
      },
      saveRegistry(text) {
        const bytes = encoder.encode(text);
        if (bytes.length > 1_000_000)
          throw new Error("The students.txt demo file exceeds the 1 MB limit.");
        const stored = file.write(bytes, { at: 0 });
        if (stored !== bytes.length)
          throw new Error("Could not write the entire students.txt file.");
        file.truncate(stored);
        file.flush();
        postMessage({ type: "registry", text });
      },
    });
    postMessage({ type: "running" });
    await exports.Program.Run(JSON.stringify(data.sources), initial);
    file?.close();
    file = undefined;
    postMessage({ type: "done" });
  } catch (error) {
    file?.close();
    const text = String(error.message ?? error).split("\n")[0];
    postMessage({ type: "error", text });
  }
}, { once: true });
