import {normalize} from '../public/model.js';
import {buildAndroidAPK,newAndroidIdentity} from './android.mjs';
import {appIcon} from './zip.mjs';
const encoder=new TextEncoder();
const random=()=>crypto.randomUUID().replaceAll('-','');
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function digestBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
async function hash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0;}
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
 if(['publish','unpublish','export'].includes(action))return json({error:'خروجی وب‌اپ حذف شده است. از گزینه ساخت و دانلود APK استفاده کنید.',code:'APK_ONLY'},410);
 if(action==='apk'&&method==='POST'){
  if(!assets['android-runtime.json'])fail('موتور ساخت اندروید هنوز آماده نیست؛ چند دقیقه دیگر امتحان کنید.',503);
  let identity=await store.get('android-key:'+app.id);if(!identity){const fresh=await newAndroidIdentity(app.id);if(await store.create('android-key:'+app.id,fresh))identity=fresh;else identity=await store.get('android-key:'+app.id);}
  const apk=await buildAndroidAPK(app.config,assets,identity);app.apkBuilds=(app.apkBuilds||0)+1;app.lastBuiltAt=Date.now();await store.set('app:'+app.id,app);
  return new Response(apk,{headers:{'content-type':'application/vnd.android.package-archive','content-disposition':`attachment; filename="android-${app.id}.apk"`,'cache-control':'no-store','x-content-type-options':'nosniff','x-android-package':identity.packageName,'x-apk-sha256':await digestBytes(apk)}});
 }
 if(!action&&method==='GET')return json({app});if(!action&&method==='PUT'){const b=await body();app.config=normalize(b.config);app.updatedAt=Date.now();await store.set('app:'+app.id,app);return json({app});}
 if(!action&&method==='DELETE'){if(app.slug){await store.del('published:'+app.slug);await store.del('slug:'+app.slug);}await store.del('android-key:'+app.id);await store.del('app:'+app.id);return json({ok:true});}}
 if(path==='/api/admin'){requireUser();if(user.role!=='admin')fail('دسترسی شما به این صفحه مجاز نیست.',403);const users=await store.list('user:'),apps=await store.list('app:');return json({users:users.map(publicUser),apps:await Promise.all(apps.map(async a=>({id:a.id,owner:a.owner,name:a.config.name,template:a.config.template,slug:null,apkBuilds:a.apkBuilds||0,views:0,createdAt:a.createdAt}))),counts:{users:users.length,apps:apps.length,builds:apps.reduce((n,a)=>n+(a.apkBuilds||0),0),published:0}});}
 if(path.startsWith('/apps/')){if(path.endsWith('/sw.js'))return new Response("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.claim())));",{headers:{'content-type':'text/javascript','cache-control':'no-store'}});return new Response('خروجی وب‌اپ غیرفعال شده است. فایل APK را از اپلیکیشن‌ساز دریافت کنید.',{status:410,headers:{'content-type':'text/plain; charset=utf-8'}});}
 if(path.startsWith('/api/'))fail('مسیر پیدا نشد.',404);
 if(path==='/admin'&&(!user||user.role!=='admin'))return new Response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/font.css"><body style="font-family:Vazirmatn,Tahoma;background:#100f18;color:#fff;text-align:center;padding:15vh 20px"><h1>دسترسی شما به این صفحه مجاز نیست.</h1><p>برای مشاهده پنل، با حساب مدیر وارد شوید.</p><a style="color:#b9a7ff" href="/account">ورود به حساب کاربری</a></body></html>',{status:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
 return null;
 }catch(error){if(!error.status)console.error('Request failed:',error.message);return json({error:error.status?error.message:'خطایی رخ داد؛ دوباره تلاش کنید.'},error.status||500);}}
