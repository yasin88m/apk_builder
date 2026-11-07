import {demo,normalize,esc,templates,palettes} from './model.js';

const blockDefs = [
  ['hero','بنر اصلی','تصویر و پیام آغازین'],
  ['search','جستجو','کادر جستجوی محتوا'],
  ['categories','دسته‌بندی‌ها','فهرست دسته‌های کسب‌وکار'],
  ['featured','محصولات و خدمات','کارت‌های محصولات یا خدمات'],
  ['about','درباره ما','متن معرفی کسب‌وکار'],
  ['gallery','گالری تصاویر','نمایش تصاویر منتخب'],
  ['reviews','دیدگاه مشتریان','نظرات و بازخوردها'],
  ['plans','پلن‌ها و تعرفه‌ها','بسته‌ها و قیمت‌ها'],
  ['contact','تماس با ما','راه‌های ارتباطی'],
  ['text','متن دلخواه','عنوان و متن آزاد'],
  ['image','تصویر','تصویر مستقل با توضیح'],
  ['button','دکمه اقدام','دکمه هدایت به بخش مجموعه'],
  ['logo','لوگو و نام','نمایش هویت برند'],
  ['divider','خط جداکننده','تفکیک بصری بخش‌ها'],
  ['spacer','فاصله‌گذار','تنظیم فاصله بین بخش‌ها']
];
const defaults = {
 hero:{title:'به کسب‌وکار ما خوش آمدید',text:'خدمات و محصولات منتخب را اینجا ببینید.',buttonText:'مشاهده مجموعه',padding:22,radius:22,align:'right'},
 search:{title:'جستجو',padding:8,radius:14},
 categories:{title:'دسته‌بندی‌ها',padding:8,radius:16},
 featured:{title:'منتخب‌های ما',text:'بهترین پیشنهادها برای شما',padding:8,radius:18},
 about:{title:'داستان ما',text:'اینجا داستان و ارزش‌های کسب‌وکار خود را بنویسید.',padding:18,radius:18},
 gallery:{title:'گالری تصاویر',padding:8,radius:16},
 reviews:{title:'دیدگاه مشتریان',padding:8,radius:16},
 plans:{title:'پلن‌ها و تعرفه‌ها',padding:8,radius:16},
 contact:{title:'با ما در ارتباط باشید',text:'برای دریافت اطلاعات بیشتر با ما تماس بگیرید.',buttonText:'تماس با ما',padding:18,radius:18},
 text:{title:'عنوان بخش جدید',text:'متن دلخواه خود را اینجا وارد کنید.',padding:18,radius:16},
 image:{title:'تصویر کسب‌وکار',text:'توضیح کوتاه تصویر',padding:8,radius:16},
 button:{title:'دعوت به اقدام',text:'برای دیدن محصولات و خدمات بیشتر وارد شوید.',buttonText:'مشاهده مجموعه',padding:16,radius:16},
 logo:{title:'نام کسب‌وکار',text:'هویت برند شما',padding:14,radius:16},
 divider:{padding:4,radius:0},
 spacer:{padding:28,radius:0}
};
const makeId=()=> 'b'+Math.random().toString(36).slice(2,10);
function defaultBlocks(c){
 const list=['hero','search','categories','featured'];
 if(c.sections.about)list.push('about');
 if(c.sections.gallery)list.push('gallery');
 if(c.sections.reviews)list.push('reviews');
 if(c.sections.plans)list.push('plans');
 list.push('contact');
 return list.map(type=>Object.assign({id:makeId(),type,visible:true,bg:'',color:'',align:'right',padding:defaults[type].padding||8,radius:defaults[type].radius||0,fontSize:14},defaults[type]));
}
function clone(v){return JSON.parse(JSON.stringify(v));}
function safeColor(v){return /^#[0-9a-f]{6}$/i.test(v||'')?v:'';}
function fileData(file,options={}){
 return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)){reject(new Error('فقط تصویر PNG، JPG یا WebP انتخاب کنید.'));return;}
  if(file.size>12*1024*1024){reject(new Error('حجم تصویر بیشتر از ۱۲ مگابایت است.'));return;}
  const img=new Image(),reader=new FileReader();
  reader.onerror=()=>reject(new Error('خواندن تصویر ناموفق بود.'));
  reader.onload=()=>{img.onerror=()=>reject(new Error('تصویر قابل خواندن نیست.'));img.onload=()=>{
   const square=!!options.square,format=options.format||'image/webp',scale=Math.min(1,1200/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
   canvas.width=square?512:Math.max(1,Math.round(img.width*scale));canvas.height=square?512:Math.max(1,Math.round(img.height*scale));
   const ctx=canvas.getContext('2d');
   if(square){const side=Math.min(img.width,img.height),sx=(img.width-side)/2,sy=(img.height-side)/2;ctx.drawImage(img,sx,sy,side,side,0,0,512,512);}
   else ctx.drawImage(img,0,0,canvas.width,canvas.height);
   resolve(canvas.toDataURL(format,.82));
  };img.src=reader.result;};
  reader.readAsDataURL(file);
 });
}
export async function openDesigner({root,user,lang='fa'}){
 const t=(fa,en)=>lang==='en'?en:fa;
 const params=new URLSearchParams(location.search);
 let currentApp=null,config=null,selectedId=null,inspectorTab='content',device='mobile',mobilePanel='',dirty=false,saving=false;
 const undoStack=[],redoStack=[];
 const notify=message=>{const el=document.getElementById('toast');if(el){el.textContent=message;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),3500);}else alert(message);};
 async function api(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const data=response.headers.get('content-type')?.includes('application/json')?await response.json():{};
  if(!response.ok)throw new Error(data.error||'ارتباط با سرور ناموفق بود.');
  return data;
 }
 if(params.get('id')){
  try{currentApp=(await api('/api/apps/'+params.get('id'))).app;config=normalize(currentApp.config);}
  catch(e){root.innerHTML='<main class="shell"><div class="empty-state"><p>'+esc(e.message)+'</p><a class="button" href="/dashboard">بازگشت</a></div></main>';return;}
 }else{
  let cached=null;
  try{cached=JSON.parse(localStorage.getItem('app-draft:new')||'null');}catch{}
  config=normalize(cached||demo(params.get('template')||'servly'));
 }
 if(!config.builder||!Array.isArray(config.builder.blocks)||(!config.builder.enabled&&!config.builder.blocks.length))config.builder={enabled:true,blocks:defaultBlocks(config)};
 else config.builder.enabled=true;
 selectedId=config.builder.blocks[0]?.id||null;
 const blocks=()=>config.builder.blocks;
 const selected=()=>blocks().find(b=>b.id===selectedId)||null;
 function markDirty(){dirty=true;try{localStorage.setItem('app-draft:'+(currentApp?.id||'new'),JSON.stringify(config));}catch{}const s=document.querySelector('.ve-save-state');if(s)s.textContent='تغییرات ذخیره‌نشده';updatePreview();}
 function refreshHistory(){const u=document.querySelector('[data-undo]'),r=document.querySelector('[data-redo]');if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length;}
 function checkpoint(){undoStack.push(clone(config));if(undoStack.length>40)undoStack.shift();redoStack.length=0;refreshHistory();}
 function mutate(fn){checkpoint();fn();markDirty();renderInspector();renderLayers();}
 function addBlock(type,index=blocks().length){
  const d=defaults[type]||defaults.text;
  const b=Object.assign({id:makeId(),type,visible:true,bg:'',color:'',align:'right',padding:12,radius:16,fontSize:14},clone(d));
  checkpoint();blocks().splice(Math.max(0,Math.min(index,blocks().length)),0,b);selectedId=b.id;markDirty();render();
 }
 function updatePreview(){
  const frame=document.getElementById('ve-preview');
  if(frame?.contentWindow){const previewConfig=clone(config);previewConfig.builder.selectedId=selectedId;frame.contentWindow.postMessage({type:'app-preview',config:previewConfig},location.origin);}
 }
 function panelButton(name,label){return '<button class="ve-mobile-tab '+(mobilePanel===name?'active':'')+'" data-mobile-panel="'+name+'">'+label+'</button>';}
 function render(){
  document.body.classList.add('designer-open');
  root.innerHTML=
   '<div class="visual-editor" dir="rtl">'+
    '<header class="ve-topbar">'+
     '<a class="ve-brand" href="/dashboard" title="بازگشت به پروژه‌ها"><span class="ve-mark">✦</span><span>APP STUDIO<small>VISUAL EDITOR</small></span></a>'+
     '<div class="ve-project"><b>'+esc(config.appName||config.name||'اپلیکیشن من')+'</b><span class="ve-save-state">'+(dirty?'تغییرات ذخیره‌نشده':currentApp?'ذخیره‌شده':'پیش‌نویس محلی')+'</span></div>'+
     '<div class="ve-tools">'+
      '<button class="ve-tool" data-undo '+(!undoStack.length?'disabled':'')+' title="بازگشت">↶</button>'+
      '<button class="ve-tool" data-redo '+(!redoStack.length?'disabled':'')+' title="انجام دوباره">↷</button>'+
      '<span class="ve-tool-sep"></span>'+
      '<button class="ve-tool '+(device==='mobile'?'active':'')+'" data-device="mobile" title="موبایل">▯</button>'+
      '<button class="ve-tool '+(device==='tablet'?'active':'')+'" data-device="tablet" title="تبلت">▭</button>'+
      '<button class="ve-tool '+(device==='desktop'?'active':'')+'" data-device="desktop" title="نمایش عریض">▱</button>'+
      '<span class="ve-tool-sep"></span>'+
      '<button class="ve-tool ve-mobile-open" data-mobile-panel="widgets">المان‌ها</button>'+
      '<button class="ve-tool ve-mobile-open" data-mobile-panel="inspector">تنظیمات</button>'+
      '<button class="ve-action secondary" data-save>ذخیره</button>'+
      '<button class="ve-action primary" data-build>ساخت APK ↓</button>'+
     '</div>'+
    '</header>'+
    '<div class="ve-layout">'+
     '<aside class="ve-panel ve-inspector"><div class="ve-panel-head"><span class="ve-panel-icon">⚙</span><div><b>تنظیمات</b><small>PROPERTIES</small></div></div><div class="ve-inspector-tabs">'+
      '<button data-inspector-tab="content" class="'+(inspectorTab==='content'?'active':'')+'">محتوا</button>'+
      '<button data-inspector-tab="style" class="'+(inspectorTab==='style'?'active':'')+'">استایل</button>'+
      '<button data-inspector-tab="advanced" class="'+(inspectorTab==='advanced'?'active':'')+'">پیشرفته</button>'+
      '<button data-inspector-tab="page" class="'+(inspectorTab==='page'?'active':'')+'">صفحه</button>'+
     '</div><div class="ve-panel-scroll" id="ve-inspector-body">'+inspectorHTML()+'</div></aside>'+
     '<main class="ve-stage"><div class="ve-stagebar"><div><span class="ve-live-dot"></span>پیش‌نمایش زنده <small>LIVE CANVAS</small></div><div class="ve-stage-actions"><button data-blank>صفحه خالی</button><button data-add-selected>+ افزودن المان</button></div></div>'+
      '<div class="ve-canvas" id="ve-canvas"><div class="ve-device '+device+'" id="ve-device"><span class="ve-camera"></span><iframe id="ve-preview" title="پیش‌نمایش اپلیکیشن" src="/preview.html?template='+encodeURIComponent(config.template)+'"></iframe></div></div>'+
      '<div class="ve-canvas-foot"><span>ANDROID APP CANVAS</span><span>'+blocks().filter(b=>b.visible!==false).length+' بخش فعال · '+blocks().length+' المان</span></div></main>'+
     '<aside class="ve-panel ve-widgets"><div class="ve-panel-head"><span class="ve-panel-icon">▦</span><div><b>المان‌ها و ساختار</b><small>ELEMENTS & LAYERS</small></div></div>'+
      '<div class="ve-library-title">افزودن المان <span>DRAG OR CLICK</span></div><div class="ve-widget-grid">'+blockDefs.map(d=>'<button class="ve-widget" draggable="true" data-add="'+d[0]+'"><span>'+widgetIcon(d[0])+'</span><b>'+d[1]+'</b><small>'+d[2]+'</small></button>').join('')+'</div>'+
      '<div class="ve-layers-head"><b>ساختار صفحه</b><span>'+blocks().length+' لایه</span></div><div class="ve-layer-list" id="ve-layers">'+renderLayersHTML()+'</div>'+
     '</aside>'+
    '</div>'+
    '<div class="ve-mobile-dock">'+panelButton('widgets','المان‌ها +')+panelButton('inspector','تنظیمات ⚙')+'</div>'+
   '</div>';
  const frame=document.getElementById('ve-preview');frame.addEventListener('load',updatePreview);
  applyMobilePanel();
 }
 function widgetIcon(type){return ({hero:'▣',search:'⌕',categories:'▦',featured:'▤',about:'¶',gallery:'▧',reviews:'❞',plans:'◇',contact:'☎',text:'T',image:'▧',button:'▰',logo:'✦',divider:'—',spacer:'↕'})[type]||'＋';}
 function renderLayersHTML(){
  return blocks().map((b,i)=>'<div class="ve-layer '+(b.id===selectedId?'selected':'')+'" draggable="true" data-layer-id="'+esc(b.id)+'">'+
   '<button class="ve-layer-select" data-select="'+esc(b.id)+'"><span>'+widgetIcon(b.type)+'</span><span><b>'+esc(b.title||blockDefs.find(x=>x[0]===b.type)?.[1]||b.type)+'</b><small>'+((blockDefs.find(x=>x[0]===b.type)||[])[1]||b.type)+'</small></span></button>'+
   '<div class="ve-layer-actions"><button data-move="'+i+'" data-dir="-1" '+(i===0?'disabled':'')+' title="بالا">↑</button><button data-move="'+i+'" data-dir="1" '+(i===blocks().length-1?'disabled':'')+' title="پایین">↓</button><button data-duplicate="'+esc(b.id)+'" title="تکثیر">⧉</button></div></div>').join('')||'<div class="ve-empty">هنوز المانی اضافه نشده است.<br>از کتابخانه یک المان انتخاب کن.</div>';
 }
 function input(label,key,value,type='text',attrs=''){
  const attr=key.startsWith('global:')?'data-global="'+key.slice(7)+'"':'data-prop="'+key+'"';return '<label class="ve-field"><span>'+label+'</span><input type="'+type+'" '+attr+' value="'+esc(value??'')+'" '+attrs+'></label>';
 }
 function area(label,key,value){
  const attr=key.startsWith('global:')?'data-global="'+key.slice(7)+'"':'data-prop="'+key+'"';return '<label class="ve-field"><span>'+label+'</span><textarea '+attr+' rows="4">'+esc(value??'')+'</textarea></label>';
 }
 function itemField(index,field,label,value,multiline=false){
  if(multiline)return '<label class="ve-field ve-item-field"><span>'+label+'</span><textarea rows="3" data-item-index="'+index+'" data-item-field="'+field+'">'+esc(value??'')+'</textarea></label>';
  return '<label class="ve-field ve-item-field"><span>'+label+'</span><input type="text" data-item-index="'+index+'" data-item-field="'+field+'" value="'+esc(value??'')+'"></label>';
 }
 function listField(group,index,field,label,value,multiline=false){
  if(multiline)return '<label class="ve-field"><span>'+label+'</span><textarea rows="3" data-list-group="'+group+'" data-list-index="'+index+'" data-list-field="'+field+'">'+esc(value??'')+'</textarea></label>';
  return '<label class="ve-field"><span>'+label+'</span><input type="text" data-list-group="'+group+'" data-list-index="'+index+'" data-list-field="'+field+'" value="'+esc(value??'')+'"></label>';
 }
 function select(label,key,value,options){
  const attr=key.startsWith('global:')?'data-global="'+key.slice(7)+'"':'data-prop="'+key+'"';return '<label class="ve-field"><span>'+label+'</span><select '+attr+'>'+options.map(o=>'<option value="'+o[0]+'" '+(value===o[0]?'selected':'')+'>'+o[1]+'</option>').join('')+'</select></label>';
 }
 function upload(label,key,value){
  const attr=key.startsWith('global:')?'data-global-image="'+key.slice(7)+'"':'data-image="'+key+'"';return '<div class="ve-field"><span>'+label+'</span><label class="ve-upload"><input type="file" accept="image/png,image/jpeg,image/webp" '+attr+'><span>＋ بارگذاری تصویر</span></label>'+
   (value?'<div class="ve-image-preview"><img src="'+esc(value)+'" alt=""><button data-clear-image="'+key+'">حذف تصویر</button></div>':'')+'</div>';
 }
 function inspectorHTML(){
  const b=selected();
  if(inspectorTab==='page'){
   return '<div class="ve-group"><h3>هویت اپلیکیشن</h3>'+input('نام کسب‌وکار','global:name',config.name)+input('نام نمایش روی گوشی','global:appName',config.appName)+upload('لوگوی کسب‌وکار','global:logo',config.logo)+upload('آیکون نصب اندروید','global:appIcon',config.appIcon)+
    '<p class="ve-help">لوگو داخل اپ نمایش داده می‌شود؛ آیکون نصب در صفحه اصلی گوشی قرار می‌گیرد.</p></div>'+
    '<div class="ve-group"><h3>اطلاعات کسب‌وکار</h3>'+input('شعار کوتاه','global:tagline',config.tagline)+area('معرفی کوتاه','global:description',config.description)+area('درباره کسب‌وکار','global:about',config.about)+input('شماره تماس','global:phone',config.phone,'tel')+input('ایمیل','global:email',config.email,'email')+input('آدرس','global:address',config.address)+input('وب‌سایت','global:website',config.website,'url')+input('اینستاگرام','global:instagram',config.instagram,'url')+input('واتساپ','global:whatsapp',config.whatsapp,'url')+input('تلگرام','global:telegram',config.telegram,'url')+'</div>'+
    '<div class="ve-group"><h3>رنگ‌بندی کلی</h3>'+input('رنگ اصلی','global:color',config.color,'color')+input('پس‌زمینه','global:background',config.background,'color')+input('رنگ نوشته','global:ink',config.ink,'color')+
    '<div class="ve-palette-grid">'+palettes.map((p,i)=>'<button data-palette="'+i+'" title="'+p[0]+'"><i style="background:'+p[1]+'"></i><i style="background:'+p[2]+'"></i><i style="background:'+p[3]+'"></i></button>').join('')+'</div></div>'+
    '<div class="ve-group"><h3>قالب پایه</h3>'+select('نوع قالب','global:template',config.template,templates.map(x=>[x.id,x.name]))+
    '<p class="ve-help">با تغییر قالب، المان‌های سفارشی صفحه حفظ می‌شوند.</p></div>';
  }
  if(!b)return '<div class="ve-empty">یک المان از ساختار صفحه انتخاب کن یا از کتابخانه المان جدید اضافه کن.</div>';
  if(inspectorTab==='content'){
   let html='<div class="ve-selected-name"><span>'+widgetIcon(b.type)+'</span><div><b>'+esc(blockDefs.find(x=>x[0]===b.type)?.[1]||b.type)+'</b><small>محتوای المان انتخاب‌شده</small></div></div>';
   if(['hero','search','categories','featured','about','gallery','reviews','plans','contact','text','image','button','logo'].includes(b.type))html+=input('عنوان','title',b.title);
   if(['hero','about','contact','text','image','button','logo','featured'].includes(b.type))html+=area('متن و توضیحات','text',b.text);
   if(['hero','contact','button'].includes(b.type))html+=input('متن دکمه','buttonText',b.buttonText);
   if(['hero','image','logo'].includes(b.type))html+=upload('تصویر المان','image',b.image);
   if(b.type==='featured')html+='<div class="ve-group ve-items-manager"><div class="ve-items-head"><h3>محتوای محصولات و خدمات</h3><button class="ve-add-item" data-add-item>＋ افزودن</button></div><p class="ve-help">این موارد مستقیماً در کارت‌های اپلیکیشن نمایش داده می‌شوند.</p>'+(config.items||[]).map((item,i)=>'<div class="ve-item-card"><div class="ve-item-card-head"><b>مورد '+(i+1)+'</b><button data-delete-item="'+i+'" class="ve-item-remove">حذف</button></div>'+itemField(i,'title','نام محصول / خدمت',item.title)+itemField(i,'category','دسته‌بندی',item.category)+itemField(i,'price','قیمت یا توضیح قیمت',item.price)+itemField(i,'description','توضیحات',item.description,true)+'<label class="ve-upload ve-item-upload"><input type="file" accept="image/png,image/jpeg,image/webp" data-item-image="'+i+'">＋ تغییر تصویر</label>'+(item.image?'<div class="ve-image-preview"><img src="'+esc(item.image)+'" alt=""><button data-clear-item-image="'+i+'">حذف تصویر</button></div>':'')+'</div>').join('')+'</div>';
   if(b.type==='gallery')html+='<div class="ve-group"><div class="ve-items-head"><h3>تصاویر گالری</h3><span>'+(config.gallery||[]).length+'/12</span></div><div class="ve-field"><label class="ve-upload"><input type="file" accept="image/png,image/jpeg,image/webp" data-gallery-image>＋ افزودن تصویر</label></div><div class="ve-gallery-grid">'+(config.gallery||[]).map((src,i)=>'<div><img src="'+esc(src)+'" alt=""><button data-delete-gallery="'+i+'">×</button></div>').join('')+'</div></div>';
   if(b.type==='reviews')html+='<div class="ve-group"><div class="ve-items-head"><h3>دیدگاه مشتریان</h3><button class="ve-add-item" data-add-list="reviews">＋ افزودن</button></div>'+(config.reviews||[]).map((item,i)=>'<div class="ve-item-card"><div class="ve-item-card-head"><b>دیدگاه '+(i+1)+'</b><button class="ve-item-remove" data-delete-list="reviews:'+i+'">حذف</button></div>'+listField('reviews',i,'name','نام مشتری',item.name)+listField('reviews',i,'text','متن دیدگاه',item.text,true)+'</div>').join('')+'</div>';
   if(b.type==='plans')html+='<div class="ve-group"><div class="ve-items-head"><h3>پلن‌ها و تعرفه‌ها</h3><button class="ve-add-item" data-add-list="plans">＋ افزودن</button></div>'+(config.plans||[]).map((item,i)=>'<div class="ve-item-card"><div class="ve-item-card-head"><b>پلن '+(i+1)+'</b><button class="ve-item-remove" data-delete-list="plans:'+i+'">حذف</button></div>'+listField('plans',i,'title','عنوان پلن',item.title)+listField('plans',i,'price','قیمت',item.price)+listField('plans',i,'features','امکانات پلن',item.features,true)+'</div>').join('')+'</div>';
   return html;
  }
  if(inspectorTab==='style'){
   return '<div class="ve-group"><h3>رنگ و پس‌زمینه</h3>'+input('رنگ پس‌زمینه','bg',b.bg||'#ffffff','color')+input('رنگ متن','color',b.color||config.ink,'color')+
    select('تراز محتوا','align',b.align||'right',[['right','راست'],['center','وسط'],['left','چپ']])+'</div>'+
    '<div class="ve-group"><h3>ابعاد و فاصله‌ها</h3>'+input('فاصله داخلی (px)','padding',b.padding??12,'number','min="0" max="48"')+input('گردی گوشه‌ها (px)','radius',b.radius??16,'number','min="0" max="40"')+input('اندازه نوشته (px)','fontSize',b.fontSize??14,'number','min="10" max="32"')+'</div>'+
    '<div class="ve-group"><h3>نمایش</h3><label class="ve-check"><input type="checkbox" data-prop="visible" '+(b.visible===false?'':'checked')+'> نمایش این المان در اپلیکیشن</label></div>';
  }
  if(inspectorTab==='advanced'){
   return '<div class="ve-group"><h3>تنظیمات پیشرفته</h3>'+input('شناسه المان','id',b.id,'text','readonly')+
    '<p class="ve-help">شناسه برای نگهداری ترتیب و شناسایی المان استفاده می‌شود.</p>'+
    '<button class="ve-danger wide" data-delete-selected>حذف المان</button><button class="ve-neutral wide" data-duplicate="'+esc(b.id)+'">تکثیر المان</button></div>';
  }
  return '';
 }
 function renderInspector(){const body=document.getElementById('ve-inspector-body');if(body)body.innerHTML=inspectorHTML();document.querySelectorAll('[data-inspector-tab]').forEach(x=>x.classList.toggle('active',x.dataset.inspectorTab===inspectorTab));}
 function renderLayers(){const list=document.getElementById('ve-layers');if(list)list.innerHTML=renderLayersHTML();const count=document.querySelector('.ve-canvas-foot span:last-child');if(count)count.textContent=blocks().filter(b=>b.visible!==false).length+' بخش فعال · '+blocks().length+' المان';}
 function applyMobilePanel(){const editor=document.querySelector('.visual-editor');if(!editor)return;editor.classList.remove('show-widgets','show-inspector');if(mobilePanel)editor.classList.add('show-'+mobilePanel);}
 async function save(){
  if(!user){location.href='/account?next='+encodeURIComponent('/editor'+location.search);return false;}
  if(saving)return false;
  if(!config.name.trim())throw new Error('نام کسب‌وکار را وارد کنید.');
  if(new TextEncoder().encode(JSON.stringify({config})).length>2900000)throw new Error('حجم پروژه بیشتر از ۳ مگابایت است؛ چند تصویر را کوچک‌تر کنید.');
  saving=true;const button=document.querySelector('[data-save]');if(button){button.disabled=true;button.textContent='در حال ذخیره…';}
  try{
   const data=await api(currentApp?'/api/apps/'+currentApp.id:'/api/apps',{method:currentApp?'PUT':'POST',body:JSON.stringify({config})});
   currentApp=data.app;dirty=false;history.replaceState(null,'','/editor?id='+currentApp.id);
   const s=document.querySelector('.ve-save-state');if(s)s.textContent='در حساب ذخیره شد';
   try{localStorage.setItem('app-draft:'+currentApp.id,JSON.stringify(config));localStorage.removeItem('app-draft:new');}catch{}
   return true;
  }finally{saving=false;if(button){button.disabled=false;button.textContent='ذخیره';}}
 }
 async function build(){
  if(!await save())return;
  const button=document.querySelector('[data-build]');if(button){button.disabled=true;button.textContent='در حال ساخت…';}
  try{
   const response=await fetch('/api/apps/'+currentApp.id+'/apk',{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin'});
   if(!response.ok)throw new Error((await response.json()).error||'ساخت APK ناموفق بود.');
   const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=(config.appName||config.name||'android-app').replace(/[\\/:*?"<>|]/g,'')+'.apk';a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);notify('فایل APK آماده دانلود است.');
  }finally{if(button){button.disabled=false;button.textContent='ساخت APK ↓';}}
 }
 function applyGlobal(key,value){config[key]=value;}
 function setProp(key,value){
  const b=selected();if(!b)return;
  if(key==='visible')b.visible=!!value;
  else if(key==='padding'||key==='radius'||key==='fontSize')b[key]=Math.max(0,Math.min(key==='padding'?48:key==='radius'?40:32,Number(value)||0));
  else if(key==='bg'||key==='color')b[key]=safeColor(value);
  else if(key==='align')b.align=['right','center','left'].includes(value)?value:'right';
  else if(['title','text','buttonText'].includes(key))b[key]=String(value).slice(0,3000);
  else if(key==='id')return;
  markDirty();
 }
 function selectBlock(id){selectedId=id;inspectorTab='content';renderLayers();renderInspector();}
 root.addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.prop){checkpoint();setProp(el.dataset.prop,el.type==='checkbox'?el.checked:el.value);renderLayers();}
  if(el.dataset.global){checkpoint();applyGlobal(el.dataset.global,el.value);markDirty();}
  if(el.dataset.itemIndex!==undefined){const item=config.items?.[Number(el.dataset.itemIndex)];if(item){checkpoint();item[el.dataset.itemField]=String(el.value).slice(0,el.dataset.itemField==='description'?3000:150);markDirty();}}
  if(el.dataset.listGroup){const item=config[el.dataset.listGroup]?.[Number(el.dataset.listIndex)];if(item){checkpoint();item[el.dataset.listField]=String(el.value).slice(0,1000);markDirty();}}
 });
 root.addEventListener('change',async e=>{
  const el=e.target;
  try{
   if(el.dataset.image){const data=await fileData(el.files[0]);checkpoint();const b=selected();if(b)b[el.dataset.image]=data;markDirty();renderInspector();}
   if(el.dataset.globalImage){const key=el.dataset.globalImage,data=await fileData(el.files[0],key==='appIcon'?{format:'image/png',square:true}:{});checkpoint();config[key]=data;markDirty();renderInspector();}
   if(el.dataset.itemImage!==undefined){const data=await fileData(el.files[0]);const item=config.items?.[Number(el.dataset.itemImage)];if(item){checkpoint();item.image=data;markDirty();renderInspector();}}
   if(el.hasAttribute('data-gallery-image')){if((config.gallery||[]).length>=12)throw new Error('حداکثر ۱۲ تصویر برای گالری مجاز است.');const data=await fileData(el.files[0]);checkpoint();config.gallery=config.gallery||[];config.gallery.push(data);markDirty();renderInspector();}
  }catch(err){notify(err.message);}
 });
 root.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.dataset.add){addBlock(b.dataset.add);mobilePanel='';applyMobilePanel();}
   else if(b.hasAttribute('data-add-item')){if((config.items||[]).length>=30)throw new Error('حداکثر ۳۰ محصول یا خدمت می‌توانید اضافه کنید.');checkpoint();config.items=config.items||[];config.items.push({id:makeId(),title:'محصول یا خدمت جدید',description:'توضیحات محصول یا خدمت',price:'تماس بگیرید',category:'عمومی',image:'',art:'house'});markDirty();renderInspector();}
   else if(b.dataset.deleteItem!==undefined){checkpoint();config.items.splice(Number(b.dataset.deleteItem),1);markDirty();renderInspector();}
   else if(b.dataset.clearItemImage!==undefined){checkpoint();const item=config.items?.[Number(b.dataset.clearItemImage)];if(item)item.image='';markDirty();renderInspector();}
   else if(b.dataset.deleteGallery!==undefined){checkpoint();config.gallery.splice(Number(b.dataset.deleteGallery),1);markDirty();renderInspector();}
   else if(b.dataset.addList){const type=b.dataset.addList,limit=type==='reviews'?5:3;if((config[type]||[]).length>=limit)throw new Error('به حداکثر تعداد مجاز رسیده‌اید.');checkpoint();config[type]=config[type]||[];config[type].push(type==='reviews'?{name:'مشتری جدید',text:'متن دیدگاه مشتری'}:{title:'پلن جدید',price:'تماس بگیرید',features:'امکانات پلن'});markDirty();renderInspector();}
   else if(b.dataset.deleteList){const [type,index]=b.dataset.deleteList.split(':');checkpoint();config[type]?.splice(Number(index),1);markDirty();renderInspector();}
   else if(b.dataset.select){selectBlock(b.dataset.select);mobilePanel='inspector';applyMobilePanel();}
   else if(b.dataset.inspectorTab){inspectorTab=b.dataset.inspectorTab;renderInspector();}
   else if(b.dataset.mobilePanel){mobilePanel=mobilePanel===b.dataset.mobilePanel?'':b.dataset.mobilePanel;applyMobilePanel();}
   else if(b.dataset.device){device=b.dataset.device;document.querySelectorAll('[data-device]').forEach(x=>x.classList.toggle('active',x===b));document.getElementById('ve-device').className='ve-device '+device;}
   else if(b.hasAttribute('data-move')){const i=Number(b.dataset.move),n=i+Number(b.dataset.dir);if(n>=0&&n<blocks().length){checkpoint();[blocks()[i],blocks()[n]]=[blocks()[n],blocks()[i]];markDirty();renderLayers();}}
   else if(b.dataset.duplicate){const source=blocks().find(x=>x.id===b.dataset.duplicate);if(source){const copy=clone(source);copy.id=makeId();const i=blocks().indexOf(source);checkpoint();blocks().splice(i+1,0,copy);selectedId=copy.id;markDirty();render();}}
   else if(b.hasAttribute('data-delete-selected')){if(selectedId){checkpoint();config.builder.blocks=config.builder.blocks.filter(x=>x.id!==selectedId);selectedId=blocks()[0]?.id||null;markDirty();render();}}
   else if(b.dataset.clearImage){checkpoint();const target=b.dataset.clearImage;if(target==='image'){const s=selected();if(s)s.image='';}else if(target.startsWith('global:'))config[target.slice(7)]='';else config[target]='';markDirty();renderInspector();}
   else if(b.dataset.palette){const p=palettes[Number(b.dataset.palette)];if(p){checkpoint();config.color=p[1];config.background=p[2];config.ink=p[3];markDirty();renderInspector();}}
   else if(b.hasAttribute('data-blank')){if(confirm('تمام المان‌های صفحه حذف شوند؟')){checkpoint();config.builder.blocks=[];selectedId=null;markDirty();render();}}
   else if(b.hasAttribute('data-add-selected')){addBlock('text');}
   else if(b.hasAttribute('data-undo')){if(undoStack.length){redoStack.push(clone(config));config=undoStack.pop();selectedId=config.builder.blocks[0]?.id||null;dirty=true;render();refreshHistory();}}
   else if(b.hasAttribute('data-redo')){if(redoStack.length){undoStack.push(clone(config));config=redoStack.pop();selectedId=config.builder.blocks[0]?.id||null;dirty=true;render();refreshHistory();}}
   else if(b.hasAttribute('data-save')){if(await save())notify('پروژه ذخیره شد.');}
   else if(b.hasAttribute('data-build')){await build();}
   else if(b.hasAttribute('data-back')){location.href=currentApp?'/builder?id='+currentApp.id:'/builder?new=1&template='+config.template;}
  }catch(err){notify(err.message);}
 });
 root.addEventListener('dragstart',e=>{
  const widget=e.target.closest('[data-add]'),layer=e.target.closest('[data-layer-id]');
  if(widget){e.dataTransfer.setData('text/plain','add:'+widget.dataset.add);e.dataTransfer.effectAllowed='copy';document.querySelector('.visual-editor')?.classList.add('ve-dragging');}
  else if(layer){e.dataTransfer.setData('text/plain','move:'+layer.dataset.layerId);e.dataTransfer.effectAllowed='move';document.querySelector('.visual-editor')?.classList.add('ve-dragging');}
 });
 root.addEventListener('dragend',()=>document.querySelector('.visual-editor')?.classList.remove('ve-dragging'));
 root.addEventListener('dragover',e=>{if(e.target.closest('[data-layer-id],#ve-canvas')){e.preventDefault();e.dataTransfer.dropEffect=e.dataTransfer.getData('text/plain').startsWith('move:')?'move':'copy';}});
 root.addEventListener('drop',e=>{
  const layer=e.target.closest('[data-layer-id]'),payload=e.dataTransfer.getData('text/plain');if(!payload)return;e.preventDefault();document.querySelector('.visual-editor')?.classList.remove('ve-dragging');
  if(payload.startsWith('add:'))addBlock(payload.slice(4),layer?blocks().findIndex(x=>x.id===layer.dataset.layerId):blocks().length);
  else if(payload.startsWith('move:')){const from=blocks().findIndex(x=>x.id===payload.slice(5)),to=layer?blocks().findIndex(x=>x.id===layer.dataset.layerId):blocks().length-1;if(from>=0&&to>=0&&from!==to){checkpoint();const item=blocks().splice(from,1)[0];blocks().splice(Math.min(to,blocks().length),0,item);markDirty();renderLayers();}}
 });
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==document.getElementById('ve-preview')?.contentWindow)return;
  if(e.data?.type==='preview-ready')updatePreview();
  if(e.data?.type==='builder-select'){selectBlock(e.data.id);}
 });
 window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();document.querySelector('[data-undo]')?.click();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();document.querySelector('[data-redo]')?.click();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();document.querySelector('[data-save]')?.click();}
  if(e.key==='Escape'){mobilePanel='';applyMobilePanel();}
 });
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 render();
}
