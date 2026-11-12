/* BAITO 서비스 워커 — 앱 셸 캐시 + 네트워크 우선.
 * - /api/ 는 절대 캐시하지 않는다(로컬 우선 세이브와 서버 동기화는 항상 실시간)
 * - 페이지(navigate)는 네트워크 우선, 실패하면 캐시된 같은 경로 → 홈(/konbini) → 이력서(/)
 * - /_next/static/ 은 내용 해시가 붙으므로 캐시 우선
 * - 그 외 같은 출처 GET 은 네트워크 우선, 성공 응답을 캐시에 적어 둔다
 * 버전을 올리면 activate 에서 이전 캐시를 지운다. */
const VERSION = "baito-v1";
const SHELL = ["/", "/konbini", "/konbini/receipt", "/konbini/regulars", "/konbini/league", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isCacheable(response) {
  return response && response.ok && (response.type === "basic" || response.type === "default");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API·Next 내부 데이터(RSC 페이로드 등)는 캐시 금지
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/")) return;

  // 정적 자산 — 캐시 우선
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response)) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // 페이지 — 네트워크 우선, 오프라인이면 캐시된 셸
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(request)) ||
            (await cache.match("/konbini")) ||
            (await cache.match("/")) ||
            new Response("オフラインです · 오프라인이에요", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
          );
        }),
    );
    return;
  }

  // 그 외 같은 출처 GET — 네트워크 우선, 실패 시 캐시
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable(response)) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
