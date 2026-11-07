import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(['.git','dist','node_modules','.data'].includes(e.name))continue;const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(mjs|js)$/.test(p))execFileSync(process.execPath,['--check',p],{stdio:'inherit'});}}
walk('.');console.log('All JavaScript syntax checks passed.');
