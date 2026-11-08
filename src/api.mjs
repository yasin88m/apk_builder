import {normalize,esc} from '../public/model.js';
import {buildAndroidAPK,newAndroidIdentity} from './android.mjs';
import {appIcon,zipFiles} from './zip.mjs';
const encoder=new TextEncoder();
const random=()=>crypto.randomUUID().replaceAll('-','');
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function digestBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
async function hash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0;}

function webManifest(config){
 const c=normalize(config),iconType=c.appIcon.match(/^data:image\/(png|jpeg|webp);base64,/)?.[1]||'png';
 return {name:c.appName||c.name,short_name:(c.appName||c.name).slice(0,24),description:c.description,start_url:'./',scope:'./',display:'standalone',background_color:c.background,theme_color:c.color,icons:[{src:'./icon.png',sizes:'512x512',type:'image/'+iconType,purpose:'any maskable'}]};
}
function webIcon(config){
 const c=normalize(config),match=c.appIcon.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
 return match?{bytes:Uint8Array.from(atob(match[2]),ch=>ch.charCodeAt(0)),type:'image/'+match[1]}:{bytes:appIcon(512,c.color),type:'image/png'};
}
function webPage(config){
 const c=normalize(config),serialized=JSON.stringify(c).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="'+c.lang+'" dir="'+(c.lang==='en'?'ltr':'rtl')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="'+esc(c.color)+'"><meta name="description" content="'+esc(c.description.slice(0,180))+'"><link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./icon.png"><link rel="apple-touch-icon" href="./icon.png"><link rel="stylesheet" href="./font.css"><link rel="stylesheet" href="./mobile.css"><link rel="stylesheet" href="./scene.css"><title>'+esc(c.name)+'</title></head><body><main id="mobile-app"></main><script id="app-config" type="application/json">'+serialized+'</script><script type="module">import"./mobile.js";if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});</script></body></html>';
}
function webServiceWorker(slug,publishedAt){
 const cache='app-'+slug+'-'+publishedAt,files=['./','./mobile.js','./model.js','./scene.js','./scene.css','./mobile.css','./font.css','./manifest.webmanifest','./icon.png'];
 return 'const CACHE='+JSON.stringify(cache)+',FILES='+JSON.stringify(files)+';self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("app-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;}).catch(()=>caches.match("./"))));});';
}

export async function handle(request,store,assets,env={}){const url=new URL(request.url),path=url.pathname,method=request.method;const secure=url.protocol==='https:'?'; Secure':'';try{
 if(!['GET','HEAD','POST','PUT','DELETE'].includes(method))return json({error:'روش درخواست مجاز نیست.'},405);
 if(['POST','PUT','DELETE'].includes(method)){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail('درخواست از مبدأ نامعتبر است.',403);if(request.headers.get('sec-fetch-site')==='cross-site')fail('درخواست مجاز نیست.',403);}
 const token=request.headers.get('cookie')?.match(/(?:^|;\s*)app_session=([a-f\d]{64})(?:;|$)/)?.[1];const session=token?await store.get('session:'+await digest(token)):null;const user=session&&session.expires>Date.now()?await store.get('user:'+session.userId):null;
 const publicUser=u=>u?{id:u.id,name:u.name,email:u.email,role:u.role}:null;
 const requireUser=()=>user||fail('برای ادامه وارد حساب کاربری شوید.',401);
 const body=async()=>{if(!request.headers.get('content-type')?.startsWith('application/json'))fail('درخواست باید JSON باشد.',415);if(Number(request.headers.get('content-length'))>3000000)fail('حجم پروژه بیشتر از ۳ مگابایت است.',413);const reader=request.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();fail('حجم پروژه بیشتر از ۳ مگابایت است.',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}try{return JSON.parse(raw);}catch{fail('ساختار اطلاعات نامعتبر است.');}};
 const own=async id=>{requireUser();if(!/^[a-f\d]{32}$/.test(id))fail('پروژه پیدا نشد.',404);const app=await store.get('app:'+id);if(!app||app.owner!==user.id)fail('پروژه پیدا نشد.',404);return app;};
 if(path==='/api/me')return json({user:publicUser(user)});
 if(['/api/register','/api/login'].includes(path)&&method==='POST'){
  const b=await body(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160)fail('ایمیل معتبر وارد کنید.');if(password.length<8||password.length>128)fail('رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشد.');
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-client-ip')||'local';const rateKey='rate:'+await digest(ip)+':'+Math.floor(Date.now()/900000);const attempts=await store.get(rateKey)||0;if(attempts>=25)fail('تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه دیگر امتحان کنید.',429);await store.increment(rateKey);
  const emailKey='email:'+email;let accountId=await store.get(emailKey),account=accountId?await store.get('user:'+accountId):null;
  if(path==='/api/register'){
   if(email===env.ADMIN_EMAIL?.toLowerCase()||account)fail('این ایمیل قابل ثبت‌نام نیست.',409);const name=String(b.name||'').trim().slice(0,100);if(!name)fail('نام خود را وارد کنید.');const salt=random(),id=random();account={id,email,name,role:'user',salt,password:await hash(password,salt),createdAt:Date.now()};await store.set('user:'+id,account);if(!await store.create(emailKey,id)){await store.del('user:'+id);fail('این ایمیل قبلاً ثبت شده است.',409);}
  }else{
   if(env.ADMIN_EMAIL&&env.ADMIN_PASSWORD&&email===env.ADMIN_EMAIL.toLowerCase()&&equal(password,env.ADMIN_PASSWORD)){
    if(!account){const id=random();account={id,email,name:'مدیر',role:'admin',createdAt:Date.now()};await store.set('user:'+id,account);if(!await store.create(emailKey,id)){await store.del('user:'+id);account=await store.get('user:'+await store.get(emailKey));}}
    if(account.role!=='admin')fail('دسترسی مدیر برای این حساب تنظیم نشده است.',403);
   }else{const candidate=await hash(password,account?.salt||'unregistered-user-salt');if(!account?.password||!equal(candidate,account.password)||account.role==='admin')fail('ایمیل یا رمز عبور صحیح نیست.',401);}
  }
  const newToken=random()+random();await store.set('session:'+await digest(newToken),{userId:account.id,expires:Date.now()+7*86400000});return json({user:publicUser(account)},200,{'set-cookie':`app_session=${newToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`});
 }
 if(path==='/api/logout'&&method==='POST'){if(token)await store.del('session:'+await digest(token));return json({ok:true},200,{'set-cookie':`app_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`});}
 if(path==='/api/apps'&&method==='GET'){requireUser();const apps=(await store.list('app:')).filter(a=>a.owner===user.id);return json({apps:apps.map(a=>({...a,views:0}))});}
 if(path==='/api/apps'&&method==='POST'){requireUser();const existing=(await store.list('app:')).filter(a=>a.owner===user.id);if(existing.length>=30)fail('حداکثر ۳۰ پروژه می‌توانید بسازید.');const b=await body();const app={id:random(),owner:user.id,config:normalize(b.config),slug:null,createdAt:Date.now(),updatedAt:Date.now()};await store.set('app:'+app.id,app);return json({app},201);}
 const match=path.match(/^\/api\/apps\/([a-f\d]{32})(?:\/(apk|publish|unpublish|export))?$/);if(match){const app=await own(match[1]),action=match[2];
 if(action==='publish'&&method==='POST'){
   const publishedAt=Date.now(),record={appId:app.id,owner:app.owner,config:app.config,publishedAt};
   if(app.slug)await store.set('published:'+app.slug,record);
   else{let slug='';for(let i=0;i<5&&!slug;i++){const candidate=random().slice(0,12);if(await store.create('published:'+candidate,record))slug=candidate;}if(!slug)fail('ساخت لینک انتشار ناموفق بود؛ دوباره تلاش کنید.',503);app.slug=slug;}
   app.updatedAt=publishedAt;await store.set('app:'+app.id,app);return json({app,url:url.origin+'/apps/'+app.slug+'/'});
  }
  if(action==='unpublish'&&method==='POST'){
   if(app.slug)await store.del('published:'+app.slug);app.slug=null;app.updatedAt=Date.now();await store.set('app:'+app.id,app);return json({app});
  }
  if(action==='export'&&method==='GET'){
   const files={'index.html':webPage(app.config),'mobile.js':assets['mobile.js']||'','model.js':assets['model.js']||'','scene.js':assets['scene.js']||'','scene.css':assets['scene.css']||'','mobile.css':assets['mobile.css']||'','font.css':assets['font.css']||'','manifest.webmanifest':JSON.stringify(webManifest(app.config),null,2),'sw.js':webServiceWorker('export-'+app.id,Date.now()),'icon.png':webIcon(app.config).bytes};
   if(!files['mobile.js']||!files['model.js']||!files['mobile.css'])fail('فایل‌های وب‌اپ آماده نیستند.',503);
   const archive=zipFiles(files);return new Response(archive,{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="web-app-'+app.id.slice(0,8)+'.zip"','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
 if(action==='apk'&&method==='POST'){
  if(!assets['android-runtime.json'])fail('موتور ساخت اندروید هنوز آماده نیست؛ چند دقیقه دیگر امتحان کنید.',503);
  let identity=await store.get('android-key:'+app.id);if(!identity){const fresh=await newAndroidIdentity(app.id);if(await store.create('android-key:'+app.id,fresh))identity=fresh;else identity=await store.get('android-key:'+app.id);}
  const apk=await buildAndroidAPK(app.config,assets,identity);app.apkBuilds=(app.apkBuilds||0)+1;app.lastBuiltAt=Date.now();await store.set('app:'+app.id,app);
  return new Response(apk,{headers:{'content-type':'application/vnd.android.package-archive','content-disposition':`attachment; filename="android-${app.id}.apk"`,'cache-control':'no-store','x-content-type-options':'nosniff','x-android-package':identity.packageName,'x-apk-sha256':await digestBytes(apk)}});
 }
 if(!action&&method==='GET')return json({app});if(!action&&method==='PUT'){const b=await body();app.config=normalize(b.config);app.updatedAt=Date.now();await store.set('app:'+app.id,app);if(app.slug)await store.set('published:'+app.slug,{appId:app.id,owner:app.owner,config:app.config,publishedAt:app.updatedAt});return json({app});}
 if(!action&&method==='DELETE'){if(app.slug){await store.del('published:'+app.slug);await store.del('slug:'+app.slug);}await store.del('android-key:'+app.id);await store.del('app:'+app.id);return json({ok:true});}}
 if(path==='/api/admin'){requireUser();if(user.role!=='admin')fail('دسترسی شما به این صفحه مجاز نیست.',403);const users=await store.list('user:'),apps=await store.list('app:');return json({users:users.map(publicUser),apps:await Promise.all(apps.map(async a=>({id:a.id,owner:a.owner,name:a.config.name,template:a.config.template,slug:a.slug||null,apkBuilds:a.apkBuilds||0,views:0,createdAt:a.createdAt}))),counts:{users:users.length,apps:apps.length,builds:apps.reduce((n,a)=>n+(a.apkBuilds||0),0),published:apps.filter(a=>!!a.slug).length}});}
 if(path.startsWith('/apps/')){
   const matchPublic=path.match(/^\/apps\/([a-z0-9-]{6,40})(?:\/(.*))?$/i);if(!matchPublic)return new Response('Not found',{status:404});
   const slug=matchPublic[1],resource=matchPublic[2]||'',published=await store.get('published:'+slug);if(!published)return new Response('این وب‌اپ منتشر نشده یا لینک آن معتبر نیست.',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
   const config=normalize(published.config),noStore={'cache-control':'no-store','x-content-type-options':'nosniff'};
   if(!path.endsWith('/')&&!resource)return new Response(null,{status:302,headers:{location:'/apps/'+slug+'/',...noStore}});
   if(resource===''||resource==='index.html')return new Response(webPage(config),{headers:{'content-type':'text/html; charset=utf-8',...noStore}});
   if(resource==='manifest.webmanifest')return new Response(JSON.stringify(webManifest(config)),{headers:{'content-type':'application/manifest+json; charset=utf-8','cache-control':'public, max-age=300'}});
   if(resource==='sw.js')return new Response(webServiceWorker(slug,published.publishedAt||0),{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-cache','service-worker-allowed':'/apps/'+slug+'/'}});
   if(resource==='icon.png'){const icon=webIcon(config);return new Response(icon.bytes,{headers:{'content-type':icon.type,'cache-control':'public, max-age=86400'}});}
   if(['mobile.js','model.js','scene.js','scene.css','mobile.css','font.css'].includes(resource)&&assets[resource])return new Response(assets[resource],{headers:{'content-type':resource.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','cache-control':'public, max-age=3600'}});
   return new Response('Not found',{status:404});
  }
 if(path.startsWith('/api/'))fail('مسیر پیدا نشد.',404);
 if(path==='/admin'&&(!user||user.role!=='admin'))return new Response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/font.css"><body style="font-family:Vazirmatn,Tahoma;background:#100f18;color:#fff;text-align:center;padding:15vh 20px"><h1>دسترسی شما به این صفحه مجاز نیست.</h1><p>برای مشاهده پنل، با حساب مدیر وارد شوید.</p><a style="color:#b9a7ff" href="/account">ورود به حساب کاربری</a></body></html>',{status:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
 return null;
 }catch(error){if(!error.status)console.error('Request failed:',error.message);return json({error:error.status?error.message:'خطایی رخ داد؛ دوباره تلاش کنید.'},error.status||500);}}
