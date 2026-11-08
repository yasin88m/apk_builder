import {findSceneNode,sceneDescendants,cloneSceneNode} from './scene.js';
// Physical letter keys keep editor commands working when the keyboard is Persian.
export function studioKey(event){return /^Key[A-Z]$/.test(event.code||'')?event.code.slice(3).toLowerCase():String(event.key||'').toLowerCase();}
// Used on the first actual Alt-drag movement; descendants get fresh identities once.
export function duplicateSceneSelection(page,ids){const roots=ids.map(id=>findSceneNode(page,id)?.node).filter(Boolean).filter(n=>!ids.some(id=>id!==n.id&&sceneDescendants(findSceneNode(page,id)?.node||{children:[]}).some(c=>c.id===n.id)));return roots.map(n=>{const entry=findSceneNode(page,n.id),clone=cloneSceneNode(n);entry.list.splice(entry.list.indexOf(n)+1,0,clone);return clone.id;});}
