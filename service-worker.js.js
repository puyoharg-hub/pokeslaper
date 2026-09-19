// sw.js
// ポケモン/道具スプライト画像をキャッシュし、再表示を高速化するService Worker。
//
// 背景:
// ポケモンスプライトは archives.bulbagarden.net の Special:FilePath という
// 「実ファイルへのリダイレクトURL」を使っている。ブラウザは最終的な画像バイト列を
// キャッシュしても、このリダイレクトを踏む工程自体は毎回やり直すことが多く、
// 結果として再表示のたびに待たされる。
//
// 対策として、このService Workerが該当ドメインへのリクエストを横取りし、
// 「リダイレクト解決後のレスポンスそのもの」をCache Storageに保存する。
// 2回目以降は保存済みレスポンスを即座に返すため、ネットワークにすら出ない。

const SPRITE_CACHE = 'pokeslaper-sprite-cache-v1';

// キャッシュ対象にするホスト（ポケモンスプライト・道具アイコンの配信元）
const CACHEABLE_HOSTS = [
  'archives.bulbagarden.net',
  'raw.githubusercontent.com',
];

function isCacheableRequest(request) {
  if (request.method !== 'GET') return false;
  try {
    const url = new URL(request.url);
    return CACHEABLE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

self.addEventListener('install', () => {
  // 新しいService Workerをすぐ有効化する
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // キャッシュ対象外のリクエスト（HTML/CSS/JS本体など）はブラウザ標準の挙動に任せる
  if (!isCacheableRequest(request)) return;

  event.respondWith(
    caches.open(SPRITE_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      // 初回のみネットワーク取得（Special:FilePathのリダイレクトもここで解決される）
      const response = await fetch(request);
      // opaqueレスポンス(no-corsのクロスオリジン画像)でもCache APIには保存可能
      cache.put(request, response.clone());
      return response;
    })
  );
});
