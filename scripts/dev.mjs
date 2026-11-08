import { createServer, loadEnv } from 'vite';
Object.assign(process.env,loadEnv('development',process.cwd(),''));
const routes={
  '/api/analyze':'../api/analyze.js',
  '/api/analyze-sms':'../api/analyze-sms.js',
  '/api/analyze-call':'../api/analyze-call.js',
  '/api/benchmark-models':'../api/benchmark-models.js',
};
const server=await createServer({
  server:{host:'127.0.0.1',port:Number(process.env.TSECURE_PORT||5173),strictPort:true},
  plugins:[{
    name:'local-vercel-functions',
    configureServer(vite) {
      vite.middlewares.use(async (req,res,next)=>{
        const path=req.url.split('?')[0];
        if (!path.startsWith('/api/')) return next();
        res.status=(code)=>{res.statusCode=code;return res;};
        res.json=(data)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
        if (!routes[path]) return res.status(404).json({error:'Endpoint not found.'});
        try {
          let raw='';
          for await (const chunk of req) {raw+=chunk;if(Buffer.byteLength(raw)>60000)return res.status(413).json({error:'This request is too large.'});}
          req.body=raw ? JSON.parse(raw) : {};
          const {default:handler}=await import(routes[path]);
          await handler(req,res);
        } catch {res.status(400).json({error:'Unable to process this request.'});}
      });
    },
  }],
});
await server.listen();server.printUrls();
