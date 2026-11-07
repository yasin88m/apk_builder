import {readFile,writeFile} from 'node:fs/promises';
import {newAndroidIdentity,buildAndroidAPK} from '../src/android.mjs';
import {demo} from '../public/model.js';
const assets=Object.fromEntries(await Promise.all(['font.css','mobile.css','mobile.js','model.js','android-runtime.json'].map(async name=>[name,await readFile('public/'+name,'utf8')])));
const identity=await newAndroidIdentity('0123456789abcdef0123456789abcdef');
const config=demo('artstore');config.name='نمونه اپلیکیشن اندروید';
await writeFile('.native-build/sample.apk',await buildAndroidAPK(config,assets,identity,{versionCode:100}));
await writeFile('.native-build/sample-updated.apk',await buildAndroidAPK({...config,name:'نسخه دوم برنامه'},assets,identity,{versionCode:101}));
console.log('Created signed sample APKs with a persistent application identity.');

for(const template of ['servly','eduboss','sport'])await writeFile('.native-build/'+template+'.apk',await buildAndroidAPK(demo(template),assets,identity,{versionCode:102+['servly','eduboss','sport'].indexOf(template)}));
