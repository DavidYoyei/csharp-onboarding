import { downloadCompiler } from "./compiler-download.js";

const exercises = {
  ListExercises: {
    task: "Week 2 / Task 2",
    title: "List exercises",
    description: "Try the list operations, three ways to sum a list, and a palindrome check.",
    files: ["Program.cs", "ListTasks.cs"],
  },
  GuessMyNumber: {
    task: "Week 2 / Task 3",
    title: "Guess My Number",
    description: "Guess a number from 1 to 100. Enter each guess in the console.",
    files: ["Program.cs"],
  },
  NumberToWords: {
    task: "Week 3 / Task 4",
    title: "Number to Words",
    description: "Enter a whole number to spell it out in English.",
    files: ["Program.cs", "NumberWords.cs"],
  },
  StudentRegistry: {
    task: "Week 3 / Task 5",
    title: "Student Registry",
    description: "Register a sample student and look them up by ID. The text file is saved in this browser.",
    files: ["Program.cs", "Student.cs", "StudentStore.cs"],
  },
};

const element = (id) => document.getElementById(id);
const editor = element("editor");
const highlight = element("highlight");
const lineNumbers = element("line-numbers");
const output = element("output");
const consoleInput = element("console-input");
const status = element("status");
const runButton = element("run");
const stopButton = element("stop");
const resetButton = element("reset");
const downloadButton = element("download");
const navButtons = document.querySelectorAll("[data-exercise]");
const workspaces = new Map();
const storagePrefix = "csharp-onboarding/";
const encoder = new TextEncoder();
let current = "course";
let activeFile = "";
let openWorkspace;
let execution;
let registryText;
let isolationError = "";
let selection = 0;
let compilerFiles;

function readSaved(key) {
  try {
    return localStorage.getItem(storagePrefix + key);
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(storagePrefix + key, value);
  } catch {
    // In restricted browser sessions, edits still work until the page closes.
  }
}

async function enableConsoleInput() {
  if (crossOriginIsolated)
    return true;

  if (!navigator.serviceWorker) {
    isolationError = "Interactive input requires a browser that supports service workers.";
    return true;
  }

  try {
    await navigator.serviceWorker.register("./isolation-sw.js");
    await navigator.serviceWorker.ready;
    if (!sessionStorage.getItem(storagePrefix + "isolation-reload")) {
      sessionStorage.setItem(storagePrefix + "isolation-reload", "1");
      location.reload();
      return false;
    }
  } catch {
    // Let visitors read, edit and run non-interactive programs if isolation is blocked.
  }

  isolationError = "Interactive input is unavailable. Open the link directly in a browser tab and reload.";
  return true;
}

function setupChecklist() {
  const boxes = [...document.querySelectorAll(".checklist input")];
  function updateProgress() {
    const count = boxes.filter((box) => box.checked).length;
    element("course-progress").value = count;
    element("progress").textContent = count + " of " + boxes.length + " done";
  }
  for (const box of boxes) {
    box.checked = readSaved("week1/" + box.value) === "done";
    box.addEventListener("change", () => {
      save("week1/" + box.value, box.checked ? "done" : "");
      updateProgress();
    });
    box.disabled = false;
  }
  updateProgress();
}

function fileKey(exercise, file) {
  return exercise + "/" + file;
}

function loadWorkspace(id) {
  if (!workspaces.has(id)) {
    const pending = Promise.all(exercises[id].files.map(async (name) => {
      const key = fileKey(id, name);
      const response = await fetch(new URL("./sources/" + key, import.meta.url));
      if (!response.ok)
        throw new Error("Could not load " + name + ".");
      const original = (await response.text()).replace(/\r\n?/g, "\n");
      return [name, { original, text: readSaved(key) ?? original }];
    })).then(Object.fromEntries);
    workspaces.set(id, pending);
    pending.catch(() => {
      if (workspaces.get(id) === pending)
        workspaces.delete(id);
    });
  }
  return workspaces.get(id);
}

async function selectExercise(id) {
  const request = ++selection;
  current = id;
  stopRun();
  openWorkspace = undefined;
  element("course").hidden = id !== "course";
  element("exercise").hidden = id === "course";
  for (const button of navButtons) {
    if (button.dataset.exercise === id)
      button.setAttribute("aria-current", "page");
    else
      button.removeAttribute("aria-current");
  }
  if (id === "course")
    return;

  const info = exercises[id];
  element("task-label").textContent = info.task;
  element("exercise-title").textContent = info.title;
  element("exercise-description").textContent = info.description;
  downloadButton.hidden = id !== "StudentRegistry";
  element("files").replaceChildren();
  output.textContent = "";
  editor.value = "";
  editor.disabled = true;
  resetButton.disabled = true;
  runButton.disabled = true;
  renderCode();
  status.textContent = "Loading source";

  try {
    const workspace = await loadWorkspace(id);
    if (request !== selection)
      return;
    openWorkspace = workspace;
    for (const name of info.files) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.addEventListener("click", () => selectFile(name));
      element("files").append(button);
    }
    selectFile(info.files[0]);
    editor.disabled = false;
    resetButton.disabled = false;
    runButton.disabled = false;
    status.textContent = "Ready";
  } catch (error) {
    if (request === selection)
      status.textContent = error.message;
  }
}

function selectFile(name) {
  activeFile = name;
  editor.value = openWorkspace[name].text;
  editor.scrollTop = 0;
  editor.scrollLeft = 0;
  for (const button of element("files").children)
    button.setAttribute("aria-pressed", String(button.textContent === name));
  renderCode();
}

const tokens = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\$?@"(?:""|[^"])*"|\$?"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*\b)|(\b(?:as|bool|break|byte|catch|char|class|const|continue|else|false|for|foreach|if|in|int|long|namespace|new|null|out|private|public|readonly|return|static|string|throw|true|try|using|var|void|while)\b)/g;
const tokenTypes = ["tok-comment", "tok-string", "tok-number", "tok-keyword"];

function renderCode() {
  const code = editor.value;
  const lineCount = code.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");
  const fragment = document.createDocumentFragment();
  let previous = 0;
  for (const match of code.matchAll(tokens)) {
    fragment.append(code.slice(previous, match.index));
    const span = document.createElement("span");
    span.className = tokenTypes[match.slice(1).findIndex((part) => part !== undefined)];
    span.textContent = match[0];
    fragment.append(span);
    previous = match.index + match[0].length;
  }
  fragment.append(code.slice(previous) + "\n");
  highlight.replaceChildren(fragment);
  syncEditorScroll();
}

function syncEditorScroll() {
  highlight.scrollTop = editor.scrollTop;
  highlight.scrollLeft = editor.scrollLeft;
  lineNumbers.scrollTop = editor.scrollTop;
}

function saveDraft() {
  openWorkspace[activeFile].text = editor.value;
  save(fileKey(current, activeFile), editor.value);
  renderCode();
}

function appendOutput(text) {
  output.append(text);
  output.scrollTop = output.scrollHeight;
}

function setInputEnabled(enabled) {
  consoleInput.disabled = !enabled;
  element("send").disabled = !enabled;
  if (enabled)
    consoleInput.focus({ preventScroll: true });
}

function stopRun(message) {
  if (!execution)
    return;
  clearTimeout(execution.timeout);
  execution.download.abort();
  execution.worker?.terminate();
  execution = undefined;
  setInputEnabled(false);
  consoleInput.value = "";
  stopButton.disabled = true;
  runButton.disabled = false;
  if (message)
    status.textContent = message;
}

async function startRun() {
  if (!openWorkspace || execution)
    return;

  output.textContent = "";
  const buffer = crossOriginIsolated ? new SharedArrayBuffer(8 + 8192) : null;
  const run = { download: new AbortController(), buffer };
  execution = run;
  runButton.disabled = true;
  stopButton.disabled = false;
  status.textContent = compilerFiles ? "Starting C# runtime" : "Preparing C# compiler";

  function watchdog(milliseconds, message) {
    clearTimeout(run.timeout);
    run.timeout = setTimeout(() => {
      appendOutput("\n" + message + "\n");
      stopRun("Timed out");
    }, milliseconds);
  }

  const sources = Object.fromEntries(Object.entries(openWorkspace).map(([name, file]) => [name, file.text]));
  const registry = current === "StudentRegistry";
  let worker;
  try {
    if (!compilerFiles) {
      if (typeof DecompressionStream !== "function")
        throw new Error("This browser cannot open the C# compiler. Use a current version of Chrome, Edge, Firefox, or Safari.");

      const files = await downloadCompiler(run.download.signal, (bytes) => {
        if (execution === run)
          status.textContent = "Downloading C# compiler (" + (bytes / (1024 * 1024)).toFixed(1) + " MB)";
      });
      if (execution !== run)
        return;
      compilerFiles = files;
    }
    status.textContent = "Starting C# runtime";
    worker = new Worker(new URL("./runner.js", import.meta.url), { type: "module" });
    run.worker = worker;
  } catch (error) {
    if (execution === run) {
      appendOutput(error.message + "\n");
      stopRun("Runner unavailable");
    }
    return;
  }

  worker.addEventListener("message", ({ data }) => {
    if (execution !== run)
      return;
    if (data.type === "output") {
      appendOutput(data.text);
    } else if (data.type === "registry") {
      registryText = data.text;
    } else if (data.type === "compiling") {
      status.textContent = "Compiling C#";
      watchdog(90000, "The C# compiler did not finish. Press Run C# to retry.");
    } else if (data.type === "running") {
      status.textContent = "Running";
      watchdog(30000, "The program did not finish within 30 seconds.");
    } else if (data.type === "input") {
      clearTimeout(execution.timeout);
      status.textContent = "Waiting for input";
      setInputEnabled(true);
    } else if (data.type === "done") {
      stopRun("Finished");
    } else if (data.type === "error") {
      appendOutput(data.text + "\n");
      stopRun("Run failed");
    }
  });
  worker.addEventListener("error", () => {
    if (execution !== run)
      return;
    appendOutput("The browser could not start the C# runner. Reload and try again.\n");
    stopRun("Runner unavailable");
  });
  worker.postMessage({
    buffer, sources, registry, isolationError, compiler: compilerFiles,
  });
  watchdog(90000, "The browser could not finish starting the C# runtime. Press Run C# to retry.");
}

async function downloadRegistry() {
  try {
    let text = registryText;
    if (text === undefined) {
      const root = await navigator.storage.getDirectory();
      const folder = await root.getDirectoryHandle("csharp-onboarding");
      const handle = await folder.getFileHandle("students.txt");
      text = await (await handle.getFile()).text();
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "students.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    appendOutput("No students.txt file is available yet. Run the registry to create it.\n");
  }
}

for (const button of navButtons) {
  button.addEventListener("click", () => {
    save("exercise", button.dataset.exercise);
    selectExercise(button.dataset.exercise);
  });
}
editor.addEventListener("input", saveDraft);
editor.addEventListener("scroll", syncEditorScroll);
editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    startRun();
  }
});
runButton.addEventListener("click", startRun);
stopButton.addEventListener("click", () => stopRun("Stopped"));
resetButton.addEventListener("click", () => {
  editor.value = openWorkspace[activeFile].original;
  saveDraft();
  editor.focus();
});
downloadButton.addEventListener("click", downloadRegistry);
element("console-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (consoleInput.disabled || !execution?.buffer)
    return;
  const text = consoleInput.value;
  const bytes = encoder.encode(text);
  const state = new Int32Array(execution.buffer, 0, 2);
  new Uint8Array(execution.buffer, 8).set(bytes);
  consoleInput.value = "";
  setInputEnabled(false);
  appendOutput("> " + text + "\n");
  status.textContent = "Running";
  execution.timeout = setTimeout(() => stopRun("Timed out"), 30000);
  Atomics.store(state, 1, bytes.length);
  Atomics.store(state, 0, 1);
  Atomics.notify(state, 0);
});

if (await enableConsoleInput()) {
  setupChecklist();
  for (const button of navButtons)
    button.disabled = false;
  const selected = readSaved("exercise");
  if (selection === 0 && Object.hasOwn(exercises, selected))
    await selectExercise(selected);
}
