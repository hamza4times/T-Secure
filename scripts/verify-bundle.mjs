import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const sentinels=['TSECURE_SERVER_ONLY_OPENROUTER_SENTINEL_9127','TSECURE_SERVER_ONLY_FIREBASE_SENTINEL_5381'];
process.env.OPENROUTER_API_KEY=sentinels[0];
process.env.FIREBASE_SERVICE_ACCOUNT_JSON=sentinels[1];
const {build}=await import('vite');
await build();
let files=0;
async function inspect(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await inspect(file);
    else if(/\.(js|css|html|map)$/.test(entry.name)){
      const source=await readFile(file,'utf8');files++;
      for(const sentinel of sentinels)assert.ok(!source.includes(sentinel),'A server-only test credential entered the browser output.');
    }
  }
}
await inspect('dist');
console.log('Verified server-only credential isolation across '+files+' browser artifacts.');
