// Local-only browser harness. No production route, fixture, or participant upload.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../website',import.meta.url));
const mime={'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
export function previewServer(){return createServer(async(req,res)=>{
 try{const u=new URL(req.url,'http://localhost');let path=u.pathname;
  if(path==='/personality/sw.js')path='/assets/personality/v5/sw.js';
  if(path.startsWith('/assets/')){const f=resolve(root,'.'+path);if(!f.startsWith(root+'/assets/'))throw Error('path');const data=await readFile(f);res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream','Cache-Control':'no-store',...(path.endsWith('/sw.js')?{'Service-Worker-Allowed':'/personality/'}:{})});res.end(data);return;}
  if(path.startsWith('/personality/')){const route=path.split('/')[2];res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report studio preview</title><link rel="stylesheet" href="/assets/personality/v1/style.css"><link rel="stylesheet" href="/assets/personality/v1/charts.css"><link id="personality-presentation-style" rel="stylesheet" href="/assets/personality/v5/style.css" media="not all"><script type="module" src="/assets/personality/v5/bootstrap.mjs"></script></head><body class="personality" data-personality-route="${route}"><a class="skip-link" href="#personality-app">Skip to content</a><div class="personality-layout"><aside id="personality-sidebar" class="personality-sidebar"><nav><a data-route="report" href="/personality/report">Report</a><a data-route="library" href="/personality/library">Library</a></nav></aside><div class="personality-sheet"><header class="personality-header"><button id="sidebar-toggle" aria-expanded="true" aria-controls="personality-sidebar" aria-label="Toggle sidebar">Menu</button><span id="page-crumb"></span><span id="save-status" role="status"></span></header><main id="personality-app" tabindex="-1"></main></div></div></body></html>`);return;}
  res.writeHead(404);res.end('Not found');
 }catch{res.writeHead(404);res.end('Not found');}
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)previewServer().listen(8765,'127.0.0.1',()=>console.log('Local preview http://127.0.0.1:8765/personality/report'));
