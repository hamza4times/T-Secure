// Reuse the existing vector brand; generated PNGs are committed, so builds do
// not need a browser. Run this script only when the favicon changes.
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const favicon=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
const fullBleed=favicon.replace(' rx="16"','');
const maskable=fullBleed.replace('<path','<g transform="translate(8 8) scale(.75)"><path').replace('</svg>','</g></svg>');
const output=new URL('../public/icons/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage();
  for(const [name,size,svg] of [
    ['icon-192.png',192,favicon],['icon-512.png',512,favicon],
    ['icon-maskable-512.png',512,maskable],['apple-touch-icon.png',180,maskable],
  ]){
    const data=await page.evaluate(async({svg,size})=>{
      const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      canvas.getContext('2d').drawImage(img,0,0,size,size);return canvas.toDataURL('image/png').split(',')[1];
    },{svg,size});
    await writeFile(new URL(name,output),Buffer.from(data,'base64'));
    console.log(`Created ${name} (${size} × ${size})`);
  }
}finally{await browser.close();}
