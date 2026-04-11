const CACHE_NAME = 'ethereal-voyager-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/data.js',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/data/') || event.request.url.includes('deals.json')) {
    // API 数据采用 Network-First 策略
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedRes = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedRes));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // 静态资源采用 Cache-First 策略
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
