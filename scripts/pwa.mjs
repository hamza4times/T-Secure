import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

// Generate the worker from the finished build, including Vite's lazy Firebase
// chunks and fonts. Every deploy gets a content-based cache revision.
export function tSecurePwa(){
  let output;
  return {
    name:'tsecure-pwa',apply:'build',
    configResolved(config){output=path.resolve(config.root,config.build.outDir);},
    async closeBundle(){
      const worker=await readFile(new URL('../src/service-worker.js',import.meta.url),'utf8');
      const revision=createHash('sha256').update(worker);
      const assets=[];
      async function collect(directory){
        const entries=await readdir(directory,{withFileTypes:true});
        for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
          const file=path.join(directory,entry.name);
          if(entry.isDirectory()){await collect(file);continue;}
          const relative=path.relative(output,file).split(path.sep).join('/');
          if(!['index.html','manifest.webmanifest','favicon.svg','pcm-capture.js'].includes(relative)
            && !/^icons\/[^/]+\.png$/.test(relative)
            && !(relative.startsWith('assets/')&&!relative.endsWith('.map')))continue;
          revision.update(relative).update(await readFile(file));
          assets.push('/'+relative);
        }
      }
      await collect(output);
      const build={version:revision.digest('hex').slice(0,20),assets};
      await writeFile(path.join(output,'sw.js'),`self.__TSECURE_BUILD__=${JSON.stringify(build)};\n${worker}`);
    },
  };
}
