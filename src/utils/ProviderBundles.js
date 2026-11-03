/**
 * NexPlay Scraper Bundles
 * Auto-generated from HDHub4u & 4KHDHub Engine
 * Features:
 *  - HDHub4u (https://new10.hdhub4u.cl) for Indian Regional Movies
 *  - 4KHDHub (https://4khdhub.one) for Hollywood Movies, Series, & KDramas (ZIP Packs Ignored)
 *  - Direct Media3 ExoPlayer stream resolution (FSL Cloudflare R2 / Fast CDN)
 *  - Never holds or returns intermediate bridge URLs
 */

export const ScraperClientBundle = "\"use strict\";var HDHub4UScraperModule=(()=>{var T=Object.defineProperty;var q=Object.getOwnPropertyDescriptor;var D=Object.getOwnPropertyNames;var K=Object.prototype.hasOwnProperty;var A=(S,i)=>{for(var s in i)T(S,s,{get:i[s],enumerable:!0})},W=(S,i,s,t)=>{if(i&&typeof i==\"object\"||typeof i==\"function\")for(let e of D(i))!K.call(S,e)&&e!==s&&T(S,e,{get:()=>i[e],enumerable:!(t=q(i,e))||t.enumerable});return S};var B=S=>W(T({},\"__esModule\",{value:!0}),S);var P={};A(P,{FourKHDHubClient:()=>L,HDHub4uClient:()=>x,UniversalClientScraper:()=>z});var M=class{static async httpGet(i,s,t=12e3){let e=typeof AbortController!=\"undefined\"?new AbortController:null,r=e?setTimeout(()=>e.abort(),t):null;try{let n={\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Accept:\"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\",\"Accept-Language\":\"en-US,en;q=0.9\"};return s&&(n.Referer=s),await(await fetch(i,{headers:n,signal:e?e.signal:void 0})).text()}finally{r&&clearTimeout(r)}}static isDirectMediaStream(i){if(!i||!i.startsWith(\"http\"))return!1;let s=i.toLowerCase();return[\"hubcloud.\",\"gamerxyt.com\",\"hubdrive.\",\"greenmount.\",\"linksdrive.\",\"ceciliacdn.\",\"google.com\",\"googleusercontent.com\",\"video-downloads\",\"t.me\",\"tinyurl.com\",\"load.php\",\"how-to\"].some(r=>s.includes(r))?!1:s.includes(\"r2.cloudflarestorage.com\")||s.includes(\"bunker.monster\")||s.includes(\"valentine.guru\")||s.includes(\"pongala.life\")||s.includes(\"lenin.buzz\")||s.includes(\"workers.dev\")||s.includes(\"pixeldrain.com/api/file\")||s.includes(\"pixeldrain.dev/api/file\")||s.includes(\"fastdl\")?!0:[\".mp4\",\".mkv\",\".m3u8\",\".mpd\",\".webm\",\".avi\"].some(r=>s.includes(r))}static detectMimeType(i){let s=i.toLowerCase();return s.includes(\".m3u8\")?\"application/x-mpegURL\":s.includes(\".mpd\")?\"application/dash+xml\":s.includes(\".mkv\")?\"video/x-matroska\":s.includes(\".webm\")?\"video/webm\":\"video/mp4\"}static decodeBase64(i){try{let s=decodeURIComponent(i).trim();for(let t=0;t<3&&!(!/^[A-Za-z0-9+/=]+$/.test(s)||s.length<4);t++){let e=\"\";if(typeof atob==\"function\"?e=atob(s):typeof Buffer!=\"undefined\"&&(e=Buffer.from(s,\"base64\").toString(\"utf8\")),e.startsWith(\"http://\")||e.startsWith(\"https://\"))return e;s=e}}catch(s){}return null}static async resolveDeepHubCloudChain(i,s=\"1080p\"){let t=[],e=i;try{if(e.includes(\"hubdrive.\")||e.includes(\"greenmount.\")){let n=(await this.httpGet(e,i)).match(/href=[\"'](https?:\\/\\/[^\"']*hubcloud\\.[^\"']*)[\"']/i);n&&n[1]&&(e=n[1])}if(e.includes(\"hubcloud.\")){let r=await this.httpGet(e,i),n=\"\",u=r.match(/<a[^>]*id=[\"']download[\"'][^>]*href=[\"']([^\"']+)[\"']/i);if(u&&u[1]&&(n=u[1]),!n){let h=r.match(/var\\s+url\\s*=\\s*['\"]([^'\"]+)['\"]/i);h&&h[1]&&(n=h[1])}n&&n.startsWith(\"http\")&&(e=n)}if(e.includes(\"gamerxyt.com\")||e.includes(\"hubcloud.php\")){let r=await this.httpGet(e,e),n=null,u=null,p=null,w=null,d=null,o=null,y=/<a\\s+[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)<\\/a>/gi,k;for(;(k=y.exec(r))!==null;){let m=k[1],c=k[2].replace(/<[^>]+>/g,\"\").trim(),lc=c.toLowerCase(),lm=m.toLowerCase();if(m.startsWith(\"http\")&&!m.includes(\"google.com\")&&!m.includes(\"tinyurl\")&&!m.includes(\"t.me\")&&!m.includes(\"one.one.one\")){if((lc.includes(\"fsl server\")||lm.includes(\"r2.cloudflarestorage.com\"))&&!n)n=m;else if((lc.includes(\"fslv2\")||lc.includes(\"fastdl\")||lm.includes(\"bunker.monster\")||lm.includes(\"valentine.guru\")||lm.includes(\"lenin.buzz\"))&&!u)u=m;else if((lm.includes(\"pixeldrain\")||lc.includes(\"pixel\"))&&!p){let id=m.split(\"/u/\")[1]?.split(\"?\")[0];if(id&&id!==\"negn6f\"&&id.length>=6)p=\"https://pixeldrain.dev/api/file/\"+id}else if((lm.includes(\"hdstream4u\")||lm.includes(\"hubstream\")||lc.includes(\"watch online\"))&&!w)w=m;else if((lc.includes(\"download file\")||lm.includes(\"workers.dev\"))&&!d)d=m}}let pxlM=r.match(/var\\s+pxl\\s*=\\s*['\"]([^'\"]+)['\"]/i);if(pxlM&&pxlM[1]){let id=pxlM[1].split(\"/u/\")[1]?.split(\"?\")[0];if(id&&id!==\"negn6f\"&&id.length>=6)p=\"https://pixeldrain.dev/api/file/\"+id}let v={\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"};if(n&&this.isDirectMediaStream(n))t.push({quality:s,url:n,originalUrl:i,server:\"Download [FSL Server] (10Gbps Cloudflare R2 Direct)\",type:\"direct\",headers:v,mimeType:this.detectMimeType(n),priority:1});if(u&&this.isDirectMediaStream(u))t.push({quality:s,url:u,originalUrl:i,server:\"Download [FSLv2 Server] (Fast CDN Direct Stream)\",type:\"direct\",headers:v,mimeType:this.detectMimeType(u),priority:2});if(p&&this.isDirectMediaStream(p))t.push({quality:s,url:p,originalUrl:i,server:\"Download [PixelServer] (PixelDrain Direct CDN Stream)\",type:\"direct\",headers:v,mimeType:this.detectMimeType(p),priority:3});return t.filter(x=>{if(!x||!x.url)return!1;let u=x.url.toLowerCase(),s=(x.server||\"\").toLowerCase();if(u.includes(\"googleusercontent.com\")||u.includes(\"video-downloads\")||s.includes(\"10gbps]\")||s.includes(\"google cdn\"))return!1;return s.includes(\"fsl\")||s.includes(\"pixel\")||u.includes(\"r2.cloudflare\")||u.includes(\"fastdl\")||u.includes(\"bunker.monster\")||u.includes(\"valentine.guru\")||u.includes(\"pongala.life\")||u.includes(\"lenin.buzz\")||u.includes(\"pixeldrain\")}).sort((x,y)=>(x.priority||50)-(y.priority||50))}}catch(r){}return t}},x=class{constructor(){this.baseUrl=\"https://new10.hdhub4u.cl\"}async search(i){let s=await M.httpGet(`${this.baseUrl}/?s=${encodeURIComponent(i)}`),t=[],e=/<article[\\s\\S]*?<\\/article>|<div class=\"thumb[\\s\\S]*?<\\/div>/gi,r;for(;(r=e.exec(s))!==null;){let n=r[0],u=n.match(/href=[\"'](https:\\/\\/new5\\.hdhub4u\\.cl\\/[^\"']+)[\"']/i),h=n.match(/<p>([\\s\\S]*?)<\\/p>|alt=[\"']([^\"']+)[\"']|<h2[^>]*>([\\s\\S]*?)<\\/h2>/i),f=n.match(/src=[\"'](https?:\\/\\/[^\"']+)[\"']/i);if(u&&u[1]){let y=u[1],k=h?(h[1]||h[2]||h[3]).replace(/<[^>]+>/g,\"\").trim():\"Unknown Movie\";k=k.replace(/&#038;/g,\"&\"),!t.some(v=>v.url===y)&&!y.includes(\"/category/\")&&!y.includes(\"/tag/\")&&t.push({title:k,url:y,thumbnail:f?f[1]:void 0,provider:\"hdhub4u\"})}}return t}async extractDetails(i){var v,m,c;let s=await M.httpGet(i),t=s.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i)||s.match(/<title>([\\s\\S]*?)<\\/title>/i),e=t?t[1].replace(/<[^>]+>/g,\"\").trim().replace(/&#038;/g,\"&\"):\"Media Details\",r=i.includes(\"-series-\")||e.toLowerCase().includes(\"season\")||e.toLowerCase().includes(\"series\"),n=[],u=[],h=new Map,f=/<a\\s+[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)<\\/a>/gi,y;for(;(y=f.exec(s))!==null;){let a=y[1],l=y[2].replace(/<[^>]+>/g,\"\").trim();if(a.includes(\"hubdrive\")||a.includes(\"greenmount\")||a.includes(\"hubcloud\")||a.includes(\"hubcdn\")){let o=l.match(/(?:S(\\d+))?E(?:P)?[-.\\s]?(\\d+)/i)||l.match(/Episode[-.\\s]?(\\d+)/i),d=l.toUpperCase().includes(\"4K\")||l.includes(\"2160\"),b=l.toUpperCase().includes(\"1080P\"),p=0,g=l.match(/([0-9.]+)\\s*GB/i),w=l.match(/([0-9.]+)\\s*MB/i);if(g?p=parseFloat(g[1])*1024:w&&(p=parseFloat(w[1])),o){let C=parseInt(o[o.length-1],10).toString();h.has(C)||h.set(C,[]),h.get(C).push({quality:d?\"4K\":b?\"1080p\":\"720p\",sizeMB:p,url:a})}else u.push({text:l,href:a,sizeMB:p,is4K:d,is1080p:b})}}let k=[];if(r&&h.size>0){let a=Array.from(h.keys()).sort((l,o)=>parseInt(l,10)-parseInt(o,10));for(let l of a){let o=h.get(l),d=o.filter(g=>g.quality===\"4K\").sort((g,w)=>w.sizeMB-g.sizeMB),b=o.filter(g=>g.quality===\"1080p\").sort((g,w)=>w.sizeMB-g.sizeMB),p=d.length>0&&d[0].sizeMB>0?d[0]:b.length>0?b[0]:o[0];if(p){let g=await M.resolveDeepHubCloudChain(p.url,p.quality);g.length>0&&k.push({episodeNumber:l,title:`Episode ${l}`,links:g})}}}if(!r&&u.length>0){let a=u.filter(d=>d.is4K).sort((d,b)=>b.sizeMB-d.sizeMB),l=u.filter(d=>d.is1080p).sort((d,b)=>b.sizeMB-d.sizeMB),o=a.length>0&&a[0].sizeMB>0?a[0]:l.length>0?l[0]:u[0];if(o){let d=await M.resolveDeepHubCloudChain(o.href,o.is4K?\"4K\":o.is1080p?\"1080p\":\"720p\");n.push(...d)}}return{title:e,url:i,quality:r?((m=(v=k[0])==null?void 0:v.links[0])==null?void 0:m.quality)||\"1080p\":((c=n[0])==null?void 0:c.quality)||\"1080p\",streamingLinks:n,downloadLinks:[],episodes:r?k:void 0}}async resolveEpisodeStream(i,s=\"1080p\"){return M.resolveDeepHubCloudChain(i,s)}async getPlayableStream(i,s){let t=await this.extractDetails(i);if(s!==void 0&&t.episodes&&t.episodes.length>0){let e=s.toString().replace(/[^0-9]/g,\"\"),r=t.episodes.find(n=>n.episodeNumber.toString().replace(/[^0-9]/g,\"\")===e)||t.episodes[0];if(r&&r.links.length>0){let n=r.links.sort((a,b)=>(a.priority||50)-(b.priority||50))[0]||r.links[0];return{title:`${t.title} - ${r.title||`Episode ${r.episodeNumber}`}`,episodeNumber:r.episodeNumber,streamUrl:n.url,headers:n.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:n.mimeType||\"video/mp4\",quality:n.quality,server:n.server,size:n.size,thumbnail:t.thumbnail,backupStreams:r.links.filter(x=>x.url!==n.url)}}}if(t.streamingLinks&&t.streamingLinks.length>0){let e=t.streamingLinks.sort((a,b)=>(a.priority||50)-(b.priority||50))[0]||t.streamingLinks[0];return{title:t.title,streamUrl:e.url,headers:e.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:e.mimeType||\"video/mp4\",quality:e.quality,server:e.server,size:e.size,thumbnail:t.thumbnail,backupStreams:t.streamingLinks.filter(x=>x.url!==e.url)}}if(t.episodes&&t.episodes.length>0&&t.episodes[0].links.length>0){let e=t.episodes[0],r=e.links.sort((a,b)=>(a.priority||50)-(b.priority||50))[0]||e.links[0];return{title:`${t.title} - ${e.title||`Episode ${e.episodeNumber}`}`,episodeNumber:e.episodeNumber,streamUrl:r.url,headers:r.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:r.mimeType||\"video/mp4\",quality:r.quality,server:r.server,size:r.size,thumbnail:t.thumbnail,backupStreams:e.links.filter(x=>x.url!==r.url)}}return null}},L=class{constructor(){this.baseUrl=\"https://4khdhub.one\"}async search(i){let s=await M.httpGet(`${this.baseUrl}/?s=${encodeURIComponent(i)}`),t=[],e=/<a\\s+[^>]*href=[\"']([^\"']*(?:-movie-|-series-)[^\"']*)[\"'][^>]*>([\\s\\S]*?)<\\/a>/gi,r;for(;(r=e.exec(s))!==null;){let n=r[1],u=r[2].replace(/<[^>]+>/g,\"\").trim().replace(/\\s+/g,\" \"),h=n.startsWith(\"http\")?n:`${this.baseUrl}${n}`;t.some(f=>f.url===h)||t.push({title:u,url:h,provider:\"4khdhub\"})}return t}async extractDetails(i){var k,v,m;let s=await M.httpGet(i),t=s.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i)||s.match(/<title>([\\s\\S]*?)<\\/title>/i),e=t?t[1].replace(/<[^>]+>/g,\"\").trim():\"Media Details\",r=i.includes(\"-series-\")||e.toLowerCase().includes(\"season\")||e.toLowerCase().includes(\"series\"),n=new Map,u=[],h=s.split(`\n`);for(let c of h){if(c.toLowerCase().includes(\".zip\")||c.toLowerCase().includes(\"zip pack\")||c.toLowerCase().includes(\"batch\"))continue;let a=c.match(/(?:S(\\d+))?E(?:P)?[-.\\s]?(\\d+)/i)||c.match(/Episode[-.\\s]?(\\d+)/i),l=c.match(/href=[\"'](https?:\\/\\/[^\"']*(?:hubdrive|hubcloud|greenmount)[^\"']*)[\"']/i);if(l&&l[1]){let o=c.toUpperCase().includes(\"4K\")||c.includes(\"2160\"),d=c.toUpperCase().includes(\"1080P\"),b=o?\"4K\":d?\"1080p\":\"720p\",p=0,g=c.match(/([0-9.]+)\\s*GB/i),w=c.match(/([0-9.]+)\\s*MB/i);if(g?p=parseFloat(g[1])*1024:w&&(p=parseFloat(w[1])),a){let C=parseInt(a[a.length-1],10).toString();n.has(C)||n.set(C,[]),n.get(C).push({quality:b,sizeMB:p,url:l[1]})}else u.push({quality:b,sizeMB:p,url:l[1]})}}let f=[];if(r&&n.size>0){let c=Array.from(n.keys()).sort((a,l)=>parseInt(a,10)-parseInt(l,10));for(let a of c){let l=n.get(a),o=l.filter(p=>p.quality===\"4K\").sort((p,g)=>g.sizeMB-p.sizeMB),d=l.filter(p=>p.quality===\"1080p\").sort((p,g)=>g.sizeMB-p.sizeMB),b=o.length>0&&o[0].sizeMB>0?o[0]:d.length>0?d[0]:l[0];if(b){let p=await M.resolveDeepHubCloudChain(b.url,b.quality);p.length>0&&f.push({episodeNumber:a,title:`Episode ${a}`,links:p})}}}let y=[];if(!r&&u.length>0){let c=u.filter(o=>o.quality===\"4K\").sort((o,d)=>d.sizeMB-o.sizeMB),a=u.filter(o=>o.quality===\"1080p\").sort((o,d)=>d.sizeMB-o.sizeMB),l=c.length>0&&c[0].sizeMB>0?c[0]:a.length>0?a[0]:u[0];if(l){let o=await M.resolveDeepHubCloudChain(l.url,l.quality);y.push(...o)}}return{title:e,url:i,quality:r?((v=(k=f[0])==null?void 0:k.links[0])==null?void 0:v.quality)||\"1080p\":((m=y[0])==null?void 0:m.quality)||\"1080p\",streamingLinks:y,downloadLinks:[],episodes:r?f:void 0}}async resolveEpisodeStream(i,s=\"1080p\"){return M.resolveDeepHubCloudChain(i,s)}async getPlayableStream(i,s){let t=await this.extractDetails(i);if(s!==void 0&&t.episodes&&t.episodes.length>0){let e=s.toString().replace(/[^0-9]/g,\"\"),r=t.episodes.find(n=>n.episodeNumber.toString().replace(/[^0-9]/g,\"\")===e)||t.episodes[0];if(r&&r.links.length>0){let n=r.links.sort((a,b)=>(a.priority||50)-(b.priority||50))[0]||r.links[0];return{title:`${t.title} - ${r.title||`Episode ${r.episodeNumber}`}`,episodeNumber:r.episodeNumber,streamUrl:n.url,headers:n.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:n.mimeType||\"video/mp4\",quality:n.quality,server:n.server,size:n.size,thumbnail:t.thumbnail,backupStreams:r.links.filter(x=>x.url!==n.url)}}}if(t.streamingLinks&&t.streamingLinks.length>0){let e=t.streamingLinks.sort((a,b)=>(a.priority||50)-(b.priority||50))[0]||t.streamingLinks[0];return{title:t.title,streamUrl:e.url,headers:e.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:e.mimeType||\"video/mp4\",quality:e.quality,server:e.server,size:e.size,thumbnail:t.thumbnail,backupStreams:t.streamingLinks.filter(x=>x.url!==e.url)}}if(t.episodes&&t.episodes.length>0&&t.episodes[0].links.length>0){let e=t.episodes[0],r=e.links.sort((a,b)=>(a.priority||50)-(b.priority||50))[0]||e.links[0];return{title:`${t.title} - ${e.title||`Episode ${e.episodeNumber}`}`,episodeNumber:e.episodeNumber,streamUrl:r.url,headers:r.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:r.mimeType||\"video/mp4\",quality:r.quality,server:r.server,size:r.size,thumbnail:t.thumbnail,backupStreams:e.links.filter(x=>x.url!==r.url)}}return null}},z=class{constructor(){this.hdhub4u=new x;this.fourkhdhub=new L}async search(i,s){if(s===\"hdhub4u\")return this.hdhub4u.search(i);if(s===\"4khdhub\")return this.fourkhdhub.search(i);let[t,e]=await Promise.allSettled([this.hdhub4u.search(i),this.fourkhdhub.search(i)]),r=[];return t.status===\"fulfilled\"&&r.push(...t.value),e.status===\"fulfilled\"&&r.push(...e.value),r}async extractDetails(i){return i.includes(\"4khdhub.one\")?this.fourkhdhub.extractDetails(i):this.hdhub4u.extractDetails(i)}async resolveLink(i,s=\"1080p\"){return M.resolveDeepHubCloudChain(i,s)}async getPlayableStream(i,s){return i.includes(\"4khdhub.one\")?this.fourkhdhub.getPlayableStream(i,s):this.hdhub4u.getPlayableStream(i,s)}getMedia3Config(i){return{uri:i.url,headers:i.headers||{\"User-Agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\",Referer:\"https://gamerxyt.com/\"},mimeType:i.mimeType||\"video/mp4\"}}};if(typeof window!=\"undefined\"){let S=new x,i=new L,s=new z;window.HDHub4u=S,window.FourKHDHub=i,window.UniversalScraper=s,window.getPlayableStream=(t,e)=>s.getPlayableStream(t,e)}return B(P);})();\n";

export const ProviderBundles = {
  'movies4u': {
    posts: `
      window.module.exports.getSearchPosts = async function({ searchQuery, providerContext }) {
        if (!window.Movies4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        const results = await window.Movies4u.search(searchQuery);
        return results.map(r => ({
          title: r.title,
          link: r.url,
          image: r.thumbnail
        }));
      };
    `,
    meta: `
      window.module.exports.getMeta = async function({ link, providerContext }) {
        if (!window.Movies4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        const details = await window.Movies4u.extractDetails(link);
        return {
          title: details.title,
          image: details.thumbnail,
          quality: details.quality,
          linkList: (details.streamingLinks || []).map(s => ({
            title: s.quality + ' - ' + s.server,
            directLinks: [{ link: s.url, title: s.server, quality: s.quality, headers: s.headers, mimeType: s.mimeType }]
          })),
          episodes: details.episodes
        };
      };
    `,
    stream: `
      window.module.exports.getStream = async function({ link, type, providerContext }) {
        if (!window.Movies4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        if (link.startsWith('http') && (link.includes('r2.cloudflarestorage.com') || link.includes('cdn.lenin.buzz') || link.includes('.m3u8') || link.includes('.mkv') || link.includes('.mp4'))) {
          return [{ link: link, quality: '1080p', server: 'Direct Stream' }];
        }
        const resolved = await window.Movies4u.resolveStream(link);
        return (resolved || []).map(r => ({
          link: r.url,
          quality: r.quality,
          server: r.server,
          headers: r.headers,
          mimeType: r.mimeType
        }));
      };
    `,
    playable: `
      window.module.exports.getPlayableStream = async function({ link, episodeNumber, seasonNumber, providerContext }) {
        if (!window.Movies4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        return await window.Movies4u.getPlayableStream(link, false, episodeNumber, seasonNumber);
      };
    `
  },

  'hdhub4u': {
    posts: `
      window.module.exports.getSearchPosts = async function({ searchQuery, providerContext }) {
        if (!window.HDHub4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        const results = await window.HDHub4u.search(searchQuery);
        return results.map(r => ({
          title: r.title,
          link: r.url,
          image: r.thumbnail
        }));
      };
    `,
    meta: `
      window.module.exports.getMeta = async function({ link, providerContext }) {
        if (!window.HDHub4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        const details = await window.HDHub4u.extractDetails(link);
        return {
          title: details.title,
          image: details.thumbnail,
          quality: details.quality,
          linkList: details.streamingLinks.map(s => ({
            title: s.quality + ' - ' + s.server,
            directLinks: [{ link: s.url, title: s.server, quality: s.quality, headers: s.headers, mimeType: s.mimeType }]
          })),
          episodes: details.episodes
        };
      };
    `,
    stream: `
      window.module.exports.getStream = async function({ link, type, providerContext }) {
        if (!window.HDHub4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        if (link.startsWith('http') && (link.includes('r2.cloudflarestorage.com') || link.includes('.mkv') || link.includes('.mp4') || link.includes('workers.dev'))) {
          return [{ link: link, quality: '1080p', server: 'Direct Stream' }];
        }
        const resolved = await window.UniversalScraper.resolveLink(link);
        return resolved.map(r => ({
          link: r.url,
          quality: r.quality,
          server: r.server,
          headers: r.headers,
          mimeType: r.mimeType
        }));
      };
    `,
    playable: `
      window.module.exports.getPlayableStream = async function({ link, episodeNumber, providerContext }) {
        if (!window.HDHub4u) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        return await window.HDHub4u.getPlayableStream(link, episodeNumber);
      };
    `
  },

  '4khdhub': {
    posts: `
      window.module.exports.getSearchPosts = async function({ searchQuery, providerContext }) {
        if (!window.FourKHDHub) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        const results = await window.FourKHDHub.search(searchQuery);
        return results.map(r => ({
          title: r.title,
          link: r.url,
          image: r.thumbnail
        }));
      };
    `,
    meta: `
      window.module.exports.getMeta = async function({ link, providerContext }) {
        if (!window.FourKHDHub) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        const details = await window.FourKHDHub.extractDetails(link);
        return {
          title: details.title,
          image: details.thumbnail,
          quality: details.quality,
          linkList: details.streamingLinks.map(s => ({
            title: s.quality + ' - ' + s.server,
            directLinks: [{ link: s.url, title: s.server, quality: s.quality, headers: s.headers, mimeType: s.mimeType }]
          })),
          episodes: details.episodes
        };
      };
    `,
    stream: `
      window.module.exports.getStream = async function({ link, type, providerContext }) {
        if (!window.FourKHDHub) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        if (link.startsWith('http') && (link.includes('r2.cloudflarestorage.com') || link.includes('.mkv') || link.includes('.mp4') || link.includes('workers.dev'))) {
          return [{ link: link, quality: '4K', server: 'Direct Stream' }];
        }
        const resolved = await window.UniversalScraper.resolveLink(link);
        return resolved.map(r => ({
          link: r.url,
          quality: r.quality,
          server: r.server,
          headers: r.headers,
          mimeType: r.mimeType
        }));
      };
    `,
    playable: `
      window.module.exports.getPlayableStream = async function({ link, episodeNumber, providerContext }) {
        if (!window.FourKHDHub) {
          eval(` + JSON.stringify(ScraperClientBundle) + `);
        }
        return await window.FourKHDHub.getPlayableStream(link, episodeNumber);
      };
    `
  },

  'tamildhool': {
    posts: `
      window.module.exports.getSearchPosts = async function({ searchQuery, providerContext }) {
        if (window.TamilDhool) {
          return await window.TamilDhool.search(searchQuery);
        }
        return [];
      };
    `,
    meta: `
      window.module.exports.getMeta = async function({ link, providerContext }) {
        if (window.TamilDhool) {
          return await window.TamilDhool.extractDetails(link);
        }
        return { title: 'TamilDhool Episode', linkList: [], episodes: [] };
      };
    `,
    stream: `
      window.module.exports.getStream = async function({ link, type, providerContext }) {
        if (window.TamilDhool) {
          const playable = await window.TamilDhool.getPlayableStream(link);
          if (playable && playable.streamUrl) {
            return [{ link: playable.streamUrl, quality: playable.quality || '720p', server: playable.server || 'TamilDhool Stream', headers: playable.headers }];
          }
        }
        return [];
      };
    `,
    playable: `
      window.module.exports.getPlayableStream = async function({ link, episodeNumber, seasonNumber, providerContext }) {
        if (window.TamilDhool) {
          return await window.TamilDhool.getPlayableStream(link, false, episodeNumber, seasonNumber);
        }
        return null;
      };
    `
  },

  'tamilgun': {
    posts: `
      window.module.exports.getSearchPosts = async function({ searchQuery, providerContext }) {
        if (window.TamilGun) {
          return await window.TamilGun.search(searchQuery);
        }
        return [];
      };
    `,
    meta: `
      window.module.exports.getMeta = async function({ link, providerContext }) {
        if (window.TamilGun) {
          return await window.TamilGun.extractDetails(link);
        }
        return { title: 'TamilGun Episode', linkList: [], episodes: [] };
      };
    `,
    stream: `
      window.module.exports.getStream = async function({ link, type, providerContext }) {
        if (window.TamilGun) {
          const playable = await window.TamilGun.getPlayableStream(link);
          if (playable && playable.streamUrl) {
            return [{ link: playable.streamUrl, quality: playable.quality || '720p', server: playable.server || 'TamilGun Stream', headers: playable.headers }];
          }
        }
        return [];
      };
    `,
    playable: `
      window.module.exports.getPlayableStream = async function({ link, episodeNumber, seasonNumber, providerContext }) {
        if (window.TamilGun) {
          return await window.TamilGun.getPlayableStream(link, false, episodeNumber, seasonNumber);
        }
        return null;
      };
    `
  }
};
