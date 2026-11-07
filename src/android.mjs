import {normalize,esc} from '../public/model.js';
import {concat,crc32,zipFiles,appIcon} from './zip.mjs';
const androidEncoder=new TextEncoder();
const androidDecoder=new TextDecoder();
export const to64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);};
export const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const u32=n=>{const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,n,true);return bytes;};
const u64=n=>concat(u32(n),u32(0));
const lp=data=>concat(u32(data.length),data);
const sha256=async bytes=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
const hexBytes=s=>Uint8Array.from(s.match(/../g),v=>parseInt(v,16));
const der=(tag,...parts)=>{const data=concat(...parts);let length;if(data.length<128)length=new Uint8Array([data.length]);else{const nums=[];for(let n=data.length;n;n>>>=8)nums.unshift(n&255);length=new Uint8Array([128|nums.length,...nums]);}return concat(new Uint8Array([tag]),length,data);};
const seq=(...parts)=>der(0x30,...parts);
function derInteger(bytes){let first=0;while(first<bytes.length-1&&bytes[first]===0)first++;bytes=bytes.subarray(first);return der(2,...(bytes[0]&128?[new Uint8Array([0]),bytes]:[bytes]));}
const signatureAlgorithm=hexBytes('300d06092a864886f70d01010b0500');
export async function newAndroidIdentity(appId){
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const publicKey=new Uint8Array(await crypto.subtle.exportKey('spki',keys.publicKey));
 const privateKey=new Uint8Array(await crypto.subtle.exportKey('pkcs8',keys.privateKey));
 const name=seq(der(0x31,seq(hexBytes('0603550403'),der(0x0c,androidEncoder.encode('APK Builder '+appId)))));
 const timestamp=date=>der(0x18,androidEncoder.encode(date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z').replace('T','')));
 const serial=crypto.getRandomValues(new Uint8Array(16));serial[0]&=127;serial[0]|=1;
 const certificateData=seq(der(0xa0,derInteger(new Uint8Array([2]))),derInteger(serial),signatureAlgorithm,name,seq(timestamp(new Date(Date.now()-86400000)),timestamp(new Date(Date.now()+30*365.25*86400000))),name,publicKey);
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,certificateData));
 const certificate=seq(certificateData,signatureAlgorithm,der(3,new Uint8Array([0]),signature));
 return {privateKey:to64(privateKey),publicKey:to64(publicKey),certificate:to64(certificate),packageName:'ir.apkb.a'+appId};
}
export function zipEntries(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const eocd=bytes.length-22;if(eocd<0||view.getUint32(eocd,true)!==0x06054b50)throw new Error('Android runtime ZIP footer is invalid');let offset=view.getUint32(eocd+16,true);const count=view.getUint16(eocd+10,true),entries={};for(let i=0;i<count;i++){if(view.getUint32(offset,true)!==0x02014b50||view.getUint16(offset+10,true)!==0)throw new Error('Android runtime must use stored ZIP entries');const length=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);const name=androidDecoder.decode(bytes.subarray(offset+46,offset+46+nameLength));const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);const data=bytes.slice(start,start+length);if(crc32(data)!==view.getUint32(offset+16,true))throw new Error('Android runtime entry checksum failed');entries[name]=data;offset+=46+nameLength+extra+comment;}return entries;}
function readStringPool(bytes,start){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=v.getUint32(start+8,true),header=v.getUint16(start+2,true),flags=v.getUint32(start+16,true),dataStart=start+v.getUint32(start+20,true);const strings=[];for(let i=0;i<count;i++){let p=dataStart+v.getUint32(start+header+4*i,true);if(flags&256){let n=bytes[p++];if(n&128)p++;let length=bytes[p++];if(length&128)length=((length&127)<<8)|bytes[p++];strings.push(androidDecoder.decode(bytes.subarray(p,p+length)));}else{let length=v.getUint16(p,true);p+=2;if(length&32768){length=((length&32767)<<16)|v.getUint16(p,true);p+=2;}strings.push(new TextDecoder('utf-16le').decode(bytes.subarray(p,p+length*2)));}}return strings;}
export function patchManifest(bytes,{packageName,label,versionCode,versionName}){
 let offset=8,strings=[],parts=[];const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 while(offset<bytes.length){const type=view.getUint16(offset,true),size=view.getUint32(offset+4,true);if(!size||offset+size>bytes.length)throw new Error('Invalid binary Android manifest');let chunk=bytes.slice(offset,offset+size);
  if(type===1){strings=readStringPool(bytes,offset).map(s=>s==='com.appbuilder.template'?packageName:s==='APK_BUILDER_LABEL'?label:s==='1.0'?versionName:s);const cv=new DataView(chunk.buffer),header=cv.getUint16(2,true),styleCount=cv.getUint32(12,true),oldStyleStart=cv.getUint32(24,true);const oldStyleOffsets=chunk.slice(header+strings.length*4,header+(strings.length+styleCount)*4),styles=oldStyleStart?chunk.slice(oldStyleStart):new Uint8Array();const encoded=[],offsets=[];let total=0;const length=n=>n<128?new Uint8Array([n]):new Uint8Array([(n>>8)|128,n&255]);for(const text of strings){const utf8=androidEncoder.encode(text);const data=concat(length(text.length),length(utf8.length),utf8,new Uint8Array([0]));offsets.push(u32(total));encoded.push(data);total+=data.length;}const stringData=concat(...encoded,new Uint8Array((4-total%4)%4));const base=chunk.slice(0,header),bv=new DataView(base.buffer),stringStart=header+strings.length*4+styleCount*4;bv.setUint32(16,(cv.getUint32(16,true)|256)&~1,true);bv.setUint32(20,stringStart,true);bv.setUint32(24,styleCount?stringStart+stringData.length:0,true);bv.setUint32(4,stringStart+stringData.length+styles.length,true);chunk=concat(base,...offsets,oldStyleOffsets,stringData,styles);
  }else if(type===0x0102){const cv=new DataView(chunk.buffer),attributeStart=cv.getUint16(24,true)+16,attributeSize=cv.getUint16(26,true),attributeCount=cv.getUint16(28,true);for(let i=0;i<attributeCount;i++){const a=attributeStart+i*attributeSize;if(strings[cv.getUint32(a+4,true)]==='versionCode'){cv.setUint32(a+8,0xffffffff,true);cv.setUint8(a+15,0x10);cv.setUint32(a+16,versionCode,true);}}}
  parts.push(chunk);offset+=size;
 }
 const header=bytes.slice(0,8),out=concat(header,...parts);new DataView(out.buffer).setUint32(4,out.length,true);return out;
}
export async function signAndroidAPK(unsigned,identity){
 const view=new DataView(unsigned.buffer,unsigned.byteOffset,unsigned.byteLength),eocdOffset=unsigned.length-22,centralOffset=view.getUint32(eocdOffset+16,true);
 const sections=[unsigned.subarray(0,centralOffset),unsigned.subarray(centralOffset,eocdOffset),unsigned.subarray(eocdOffset)];const digests=[];
 for(const section of sections)for(let p=0;p<section.length;p+=1048576){const chunk=section.subarray(p,p+1048576);digests.push(await sha256(concat(new Uint8Array([0xa5]),u32(chunk.length),chunk)));}
 const digest=await sha256(concat(new Uint8Array([0x5a]),u32(digests.length),...digests));
 const algorithm=u32(0x0103),signedData=concat(lp(lp(concat(algorithm,lp(digest)))),lp(lp(from64(identity.certificate))),lp(new Uint8Array()));
 const key=await crypto.subtle.importKey('pkcs8',from64(identity.privateKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,signedData));
 const signer=concat(lp(signedData),lp(lp(concat(algorithm,lp(signature)))),lp(from64(identity.publicKey)));
 const value=lp(lp(signer)),pair=concat(u64(4+value.length),u32(0x7109871a),value),size=u64(pair.length+24);
 const block=concat(size,pair,size,androidEncoder.encode('APK Sig Block 42'));
 const footer=unsigned.slice(eocdOffset);new DataView(footer.buffer).setUint32(16,centralOffset+block.length,true);
 return concat(unsigned.subarray(0,centralOffset),block,unsigned.subarray(centralOffset,eocdOffset),footer);
}
export function nativeHTML(config){const c=normalize(config);return `<!doctype html><html data-native lang="${c.lang}" dir="${c.lang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.name)}</title><link rel="stylesheet" href="./font.css"><link rel="stylesheet" href="./mobile.css"></head><body><main id="mobile-app"></main><script id="app-config" type="application/json">${JSON.stringify(c).replace(/</g,'\\u003c')}</script><script type="module" src="./mobile.js"></script></body></html>`;}
export async function buildAndroidAPK(config,assets,identity,{versionCode=Math.floor(Date.now()/1000)-1700000000}={}){
 const runtime=JSON.parse(assets['android-runtime.json']||'null');if(!runtime?.apk)throw Object.assign(new Error('موتور ساخت اندروید هنوز آماده نشده است.'),{status:503});const base=from64(runtime.apk);const actual=Array.from(await sha256(base),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==runtime.sha256)throw new Error('Android runtime checksum failed');
 const c=normalize(config),files=zipEntries(base);files['AndroidManifest.xml']=patchManifest(files['AndroidManifest.xml'],{packageName:identity.packageName,label:c.name.slice(0,80),versionCode,versionName:'1.'+versionCode});
 for(const path of Object.keys(files))if(path.startsWith('META-INF/'))delete files[path];
 files['assets/index.html']=nativeHTML(c);for(const file of ['font.css','mobile.css','mobile.js','model.js']){const source=file==='mobile.js'?(runtime.mobileJS||assets[file]):file==='model.js'?(runtime.modelJS||assets[file]):assets[file];files['assets/'+file]=file==='mobile.js'?source.replaceAll('target="_blank"','target="_self"'):source;}
 for(const path of Object.keys(files))if(/^res\/drawable[^/]*\/icon\.png$/.test(path))files[path]=c.logo.startsWith('data:image/png;base64,')?from64(c.logo.split(',')[1]):appIcon(512,c.color);
 return signAndroidAPK(zipFiles(files,{align:4}),identity);
}
