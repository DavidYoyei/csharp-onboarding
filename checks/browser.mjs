import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.PAGES_URL;
if (!url)
  throw new Error("Set PAGES_URL to the workspace URL.");

const browser = await chromium.launch({ channel: process.env.PAGES_BROWSER_CHANNEL });
const context = await browser.newContext();
let interruptedPart;
let interruptedAttempts = 0;
let compilerDownloads = 0;
await context.route(/\/_framework\/runtime-[a-f0-9]+-\d+\.bin$/, async (route) => {
  compilerDownloads++;
  interruptedPart ??= route.request().url();
  if (route.request().url() === interruptedPart && ++interruptedAttempts === 1)
    await route.abort("connectionreset");
  else
    await route.continue();
});
const page = await context.newPage();
page.on("pageerror", (error) => console.error("Browser error:", error.message));
const pendingAssets = new Set();
const separateWasmFiles = new Set();
let downloadedBundle = false;
page.on("request", (request) => {
  if (request.url().includes("/_framework/"))
    pendingAssets.add(request.url());
  if (request.url().endsWith(".wasm"))
    separateWasmFiles.add(request.url());
});
page.on("requestfinished", (request) => pendingAssets.delete(request.url()));
page.on("requestfailed", (request) => {
  if (pendingAssets.delete(request.url()) && request.failure()?.errorText !== "net::ERR_ABORTED")
    console.error("Runtime request failed:", request.url(), request.failure()?.errorText);
});
page.on("response", (response) => {
  if (response.ok() && /\/_framework\/runtime-[a-f0-9]+-\d+\.bin$/.test(response.url()))
    downloadedBundle = true;
  if (response.status() >= 400 && pendingAssets.has(response.url()))
    console.error("Runtime asset:", response.status(), response.url());
});
const output = page.getByRole("log", { name: "Console output" });
const editor = page.getByRole("textbox", { name: "C# source code" });
const input = page.getByRole("textbox", { name: "Console input" });
const run = page.getByRole("button", { name: "Run C#" });

async function waitForStatus(expected) {
  await page.waitForFunction((status) => {
    const current = document.getElementById("status").textContent;
    return [status, "Run failed", "Timed out", "Runner unavailable"].includes(current);
  }, expected, { timeout: 300000 });
  assert.equal(await page.locator("#status").textContent(), expected, await output.textContent());
}

async function choose(name) {
  await page.getByRole("button", { name, exact: true }).click();
  await waitForStatus("Ready");
}

async function enter(value, nextStatus = "Waiting for input") {
  await input.fill(String(value));
  await input.press("Enter");
  await waitForStatus(nextStatus);
}

try {
  // This context starts without account cookies, credentials or site data.
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200);
  assert.match(await page.locator('script[type="module"]').getAttribute("src"), /\/releases\/[a-f0-9]+\/workspace\.js$/);
  const direct = await page.goto(new URL("coralpay-csharp.html", url).href, { waitUntil: "domcontentloaded" });
  assert.equal(direct.status(), 200);
  await page.waitForFunction(() => crossOriginIsolated, undefined, { timeout: 30000 });

  await page.getByRole("checkbox", { name: "Setup and your first C# program" }).check();
  await page.reload();
  assert.equal(await page.getByRole("checkbox", { name: "Setup and your first C# program" }).isChecked(), true);

  await choose("List exercises");
  const starter = await editor.inputValue();
  await editor.fill(starter.replace("4, -2, 9, 7, 3", "4, -2, 45, 7, 3"));
  await run.click();
  await waitForStatus("Finished");
  assert.ok(downloadedBundle, "The browser did not load the compressed compiler.");
  assert.equal(interruptedAttempts, 2, "The browser did not retry the interrupted compiler part.");
  const firstDownloadCount = compilerDownloads;
  assert.ok(separateWasmFiles.size <= 2, "The browser requested framework assemblies separately.");
  assert.match(await output.textContent(), /Largest: 45/);
  assert.match(await output.textContent(), /Odd positions: 4, 45, 3/);
  assert.match(await output.textContent(), /Running total: 4, 2, 47, 54, 57/);
  assert.match(await output.textContent(), /Reversed in place: 3, 7, 45, -2, 4/);
  assert.match(await output.textContent(), /Is 'Never odd or even' a palindrome\? True/);
  for (const loop of ["for", "while", "foreach"])
    assert.match(await output.textContent(), new RegExp("Sum using " + loop + ": 57"));

  await editor.fill(starter + "\nnoSuchFunction();\n");
  await run.click();
  await waitForStatus("Run failed");
  assert.match(await output.textContent(), /Program\.cs.*CS0103/);

  await editor.fill('using System;\nusing System.Threading.Tasks;\nawait Task.Delay(30);\nConsole.WriteLine("Async edit ran");');
  await run.click();
  await waitForStatus("Finished");
  assert.match(await output.textContent(), /Async edit ran/);
  assert.equal(compilerDownloads, firstDownloadCount, "A rerun downloaded the compiler again.");
  await page.getByRole("button", { name: "Reset file" }).click();
  assert.equal(await editor.inputValue(), starter);
  console.log("Signed-out editing, compilation, output and diagnostics passed.");

  await choose("Guess My Number");
  await run.click();
  await waitForStatus("Waiting for input");
  await enter("hello");
  assert.match(await output.textContent(), /Enter a whole number from 1 to 100/);
  let low = 1;
  let high = 100;
  while (low <= high) {
    const guess = Math.floor((low + high) / 2);
    await input.fill(String(guess));
    await input.press("Enter");
    await page.waitForFunction(() => {
      const status = document.getElementById("status").textContent;
      return status === "Waiting for input" || status === "Finished" || status === "Run failed";
    });
    const text = await output.textContent();
    if (text.includes("Correct!")) {
      await waitForStatus("Finished");
      break;
    }
    if (text.lastIndexOf("Too low.") > text.lastIndexOf("Too high."))
      low = guess + 1;
    else
      high = guess - 1;
  }
  assert.match(await output.textContent(), /Correct! Attempts: [1-7]/);

  await choose("Number to Words");
  await run.click();
  await waitForStatus("Waiting for input");
  await enter("0");
  await enter("-1001042");
  await enter("-9223372036854775808");
  await enter("12.5");
  assert.match(await output.textContent(), /\nzero\n/);
  assert.match(await output.textContent(), /minus one million one thousand forty-two/);
  assert.match(await output.textContent(), /minus nine quintillion/);
  assert.match(await output.textContent(), /Enter a whole number within the signed 64-bit range/);
  await enter("", "Finished");

  await choose("Student Registry");
  await run.click();
  await waitForStatus("Waiting for input");
  await enter("1");
  await enter("DEMO-001");
  await enter("Sample Student");
  await enter("Computer Science");
  assert.match(await output.textContent(), /Student registered/);
  await enter("1");
  await enter("demo-001");
  assert.match(await output.textContent(), /already registered/);

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download students.txt" }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), "students.txt");
  assert.match(await readFile(await download.path(), "utf8"), /^DEMO-001\|Sample Student\|Computer Science\r?\n$/);
  await enter("3", "Finished");
  await page.reload();
  await waitForStatus("Ready");
  await run.click();
  await waitForStatus("Waiting for input");
  await enter("2");
  await enter("demo-001");
  assert.match(await output.textContent(), /Name: Sample Student/);
  assert.match(await output.textContent(), /Course: Computer Science/);
  await enter("3", "Finished");
  assert.equal(compilerDownloads, firstDownloadCount, "Reloading downloaded the compiler again.");
  console.log("Interactive exercises, registry download and text-file persistence passed.");
} catch (error) {
  console.error("URL:", page.url());
  const debug = await page.evaluate(() => ({
    status: document.getElementById("status")?.textContent,
    console: document.getElementById("output")?.textContent,
    isolated: crossOriginIsolated,
  })).catch(() => ({}));
  console.error("Browser state:", debug);
  console.error("Pending runtime assets:", pendingAssets.size, [...pendingAssets].slice(0, 5));
  throw error;
} finally {
  await browser.close();
}
