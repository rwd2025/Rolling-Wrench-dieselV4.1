const CACHE_NAME = "rolling-wrench-v94b-portable-quotes";
const CACHE='rwd-v41-professional';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{});
