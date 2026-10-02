// シンプルなオフライン対応用サービスワーカー。
// 常にネットワークを優先し、失敗した時だけキャッシュから返す
// (このアプリは更新頻度が高いため、キャッシュを優先すると
//  古いバージョンが表示され続ける問題が起きやすいため)。
var CACHE_NAME = "diet-tracker-v1";
var APP_SHELL = [
  "diet-tracker.html",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);

  // 同一オリジンのGETリクエストのみ扱う。Firebase/Gemini等の外部APIは
  // そのままブラウザの通常処理に任せる(キャッシュしない)。
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request);
      })
  );
});
