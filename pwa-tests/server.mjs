// Serve two real production builds from one origin to exercise installed updates.
import {build} from 'vite';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const directories={};
for(const release of ['one','two']){
  directories[release]=path.resolve('artifacts/pwa',release);
  await build({
    build:{outDir:directories[release],emptyOutDir:true},
    plugins:[{name:'test-release',transformIndexHtml:{order:'post',handler:()=>[
      {tag:'meta',attrs:{name:'pwa-test-release',content:release},injectTo:'head'},
    ]}}],
  });
}
const {headers}=JSON.parse(await readFile('vercel.json','utf8'));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
let release='one',privateRequests=0;
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:5177');
  if(url.pathname==='/__test/release'){
    release=url.searchParams.get('version')==='two'?'two':'one';
    res.end(release);return;
  }
  if(url.pathname==='/api/private'){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    res.end(JSON.stringify({private:true,request:++privateRequests}));return;
  }
  if(url.pathname.startsWith('/api/')){res.statusCode=503;res.end('{}');return;}
  for(const rule of headers){
    if(rule.source==='/(.*)'||rule.source===url.pathname){
      for(const header of rule.headers)res.setHeader(header.key,header.value);
    }
  }
  const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
  const file=path.resolve(directories[release],relative);
  if(!file.startsWith(directories[release]+path.sep)){res.statusCode=403;res.end();return;}
  try{
    const content=await readFile(file);
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(content);
  }catch{res.statusCode=404;res.end('Not found');}
}).listen(5177,'127.0.0.1',()=>console.log('PWA production fixtures: http://127.0.0.1:5177'));
