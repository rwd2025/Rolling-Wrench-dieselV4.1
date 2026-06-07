const CACHE_NAME = "rolling-wrench-v93-fresh";
const CACHE='rwd-v41-professional';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{});
