import {demo,normalize,templates,resolveTemplate} from './model.js';
import {sceneFromConfig,sceneThemeTokens,localizeCommerceProject,parseCommercePrice} from './scene.js';
// Catalog content and the shared page design are independent. Keep item fields fresh
// after loading and editing a custom design, without rebuilding its page layout.
export function syncProjectCatalog(config){
 const scene=config.scene;if(!scene?.enabled)return config;
 const items=Array.isArray(config.items)?config.items:[];
 scene.products=items.map(item=>({id:item.id,title:item.title,price:item.price,description:item.description,category:item.category,image:item.image,imageCrop:item.imageCrop||null}));
 if(scene.commerce){
  const oldProducts=new Map(scene.commerce.products.map(p=>[p.id,p]));
  scene.commerce.products=items.map(item=>{const old=oldProducts.get(item.id)||{};return {...old,id:item.id,title:item.title,description:item.description,category:item.category,price:parseCommercePrice(item.price),image:item.image,imageCrop:item.imageCrop||null,brand:old.brand||'',stock:old.stock??15,rating:old.rating??4.5,sizes:old.sizes||[],colors:old.colors||[]};});
  scene.commerce.currency=items.some(item=>String(item.price).includes('$'))?'USD':'IRT';
 }
 if(!items.some(p=>p.id===scene.activeProductId))scene.activeProductId=items[0]?.id||'';
 return config;
}
export function prepareProject(config,{rebuild=false}={}){const c=localizeCommerceProject(normalize(config));if(rebuild||!c.scene?.enabled)c.scene=sceneFromConfig({...c,scene:null});return syncProjectCatalog(c);}
export function selectProjectTemplate(config,id){const sample=demo(id);return prepareProject({...config,template:sample.template,color:sample.color,background:sample.background,ink:sample.ink,builder:{...config.builder,enabled:false},scene:null},{rebuild:true});}
export function refreshTemplateProject(config){if(!config.scene||config.scene.origin==='template')config.scene=sceneFromConfig(config);return syncProjectCatalog(config);}
export function writeProjectTransfer(storage,config,{id=null,base=null}={}){const token=crypto.randomUUID();storage.setItem('studio-transfer:'+token,JSON.stringify({config,id,base,createdAt:Date.now()}));return token;}
export function readProjectTransfer(storage,token,id=null){if(!/^[a-f\d-]{36}$/i.test(token||''))return null;try{const raw=storage.getItem('studio-transfer:'+token);if(!raw)return null;const data=JSON.parse(raw);if(data.id!==(id||null)||Date.now()-data.createdAt>3600000||!data.config)return null;return data;}catch{return null;}}
export function chooseEditorProject({params,app=null,draft=null,studioDraft=null,transfer=null}){
 if(transfer)return {config:prepareProject(transfer.config),dirty:true};
 const fresh=params.get('new')==='1',template=params.get('template');
 if(fresh&&!app)return {config:prepareProject(demo(resolveTemplate(template)||'shopcart')),dirty:false};
 const base=app?.updatedAt||null,matching=studioDraft&&studioDraft.base===base&&(!template||studioDraft.config?.template===template);
 if(matching)return {config:prepareProject(studioDraft.config),dirty:true};
 if(app)return {config:prepareProject(app.config),dirty:false};
 const value=draft?.config||draft;
 if(value&&(!template||value.template===template))return {config:prepareProject(value),dirty:true};
 return {config:prepareProject(demo(templates.some(t=>t.id===template)?template:'shopcart')),dirty:false};
}
// Recolour the design document itself, including edited layouts and nested gradients.
export function applyProjectPalette(config,palette){
 const selected=Array.isArray(palette)?{color:palette[1],background:palette[2],ink:palette[3]}:palette;
 if(!selected||!['color','background','ink'].every(key=>/^#[a-f\d]{6}$/i.test(selected[key]||'')))return config;
 const previous=config.scene?.palette||{color:config.color,background:config.background,ink:config.ink},oldTokens=sceneThemeTokens(previous),nextTokens=sceneThemeTokens(selected),mapping=new Map(Object.keys(oldTokens).map(role=>[oldTokens[role].toLowerCase(),nextTokens[role]]));
 Object.assign(config,selected);
 const apply=target=>{for(const prop of ['fill','color','stroke','gradientFrom','gradientTo','textureColor','shadowColor']){const role=target.theme?.[prop],value=String(target[prop]||'').toLowerCase();if(role&&nextTokens[role])target[prop]=nextTokens[role];else if(mapping.has(value))target[prop]=mapping.get(value);}for(const child of target.children||[])apply(child);};
 if(config.scene){for(const page of config.scene.pages)apply(page);config.scene.palette={...selected};}
 return config;
}
