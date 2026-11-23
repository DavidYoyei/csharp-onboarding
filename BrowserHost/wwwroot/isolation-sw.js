self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.url.indexOf(self.registration.scope) !== 0)
    return;
  if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin")
    return;

  // GitHub Pages serves static files. Set the isolation headers in this scope
  // so the worker can share console input with the page.
  event.respondWith((async () => {
    const response = await fetch(event.request);
    if (response.status === 0 || response.redirected)
      return response;
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  })());
});
