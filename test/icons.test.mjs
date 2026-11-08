import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {appIconNames,validAppIcon,renderAppIcon} from '../public/icons.js';
import {createSceneNode,normalizeScene,renderScenePage,findSceneNode,sceneDescendants} from '../public/scene.js';
import {studioKey,duplicateSceneSelection} from '../public/studio-commands.js';
const documentWith=children=>normalizeScene({pages:[{id:'p',layout:'free',children}]});
test('official free icon catalogue has only trusted SVG paths; unknown and prototype names never render',()=>{
 assert.equal(appIconNames.length,1173);
 for(const name of appIconNames){const svg=renderAppIcon(name);assert.match(svg,/viewBox="0 0 24 24"/);assert.doesNotMatch(svg,/<script|onload|href=|foreignObject/);}
 for(const name of ['__proto__','constructor','<script>','not-an-icon']){assert.equal(validAppIcon(name),false);assert.equal(renderAppIcon(name),'');}
 assert.doesNotMatch(renderAppIcon('home-01',{size:'" onload="bad',stroke:'bad'}),/onload|NaN/);
});
test('standalone and button icons retain selection, color, size and placement after safe normalization',()=>{
 const icon=createSceneNode('icon',{iconName:'heart',w:128,h:128,color:'#ee1155',iconStroke:1.5});
 const button=createSceneNode('button',{text:'ادامه',iconName:'arrow-left',iconSide:'after',iconSize:32,iconGap:12});
 const scene=documentWith([icon,button]),[a,b]=scene.pages[0].children;
 assert.equal(a.iconName,'heart');assert.equal(a.iconStroke,1.5);assert.equal(a.w,128);assert.equal(b.iconGap,12);
 const html=renderScenePage(scene.pages[0]);assert.match(html,/role="img" aria-label="آیکون"/);assert.match(html,/ادامه<\/span><svg/);assert.match(html,/width="32"/);assert.match(html,/--scene-icon-gap:12px/);assert.doesNotMatch(html,/contenteditable|ds-resize/);
 const unsafe=documentWith([createSceneNode('icon',{iconName:'constructor',iconStroke:99}),createSceneNode('button',{iconName:'<script>',iconSize:9999,iconGap:-99,iconSide:'bad'})]).pages[0].children;
 assert.equal(unsafe[0].iconName,'');assert.equal(unsafe[0].iconStroke,4);assert.equal(unsafe[1].iconSize,512);assert.equal(unsafe[1].iconGap,0);assert.equal(unsafe[1].iconSide,'before');
});
test('physical keyboard commands work with Persian characters and keep fallback keys',()=>{
 assert.equal(studioKey({key:'ز',code:'KeyC'}),'c');assert.equal(studioKey({key:'ر',code:'KeyV'}),'v');assert.equal(studioKey({key:'ArrowLeft',code:'ArrowLeft'}),'arrowleft');assert.equal(studioKey({key:'C'}),'c');
});
const studioSource=await readFile(new URL('../public/studio.js',import.meta.url),'utf8');
function gestureHarness(){
 const handlers={};const ctx=vm.createContext({createSceneNode,findSceneNode,sceneDescendants,duplicateSceneSelection,handlers,console});
 vm.runInContext(`let scene={pages:[{id:'p',layout:'free',children:[createSceneNode('frame',{id:'one',x:10,y:20,layout:'free',children:[createSceneNode('icon',{id:'child',iconName:'heart'})]})]}]},selected=['one'],drag=null,preview=false,tool='select',zoom=100,history=[];
 const page=()=>scene.pages[0],entry=id=>findSceneNode(page(),id),container=n=>!!n.children.length;
 const checkpoint=()=>history.push(JSON.parse(JSON.stringify({scene,selected})));let commits=0,draws=0,captures=0;
 const changed=()=>commits++,draw=()=>draws++,drawCanvas=()=>draws++,drawPanels=()=>{},drawSelection=()=>{},finishText=()=>{},notice=()=>{},setSelection=id=>selected=[id],allCount=()=>page().children.flatMap(sceneDescendants).length;
 const selectedRoots=()=>selected.map(id=>entry(id).node),nodeElement=id=>({dataset:{sceneNode:id},style:{},getBoundingClientRect:()=>({width:100,height:100})});
 const root={addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture:()=>captures++,querySelectorAll:()=>[]};
 const document={elementsFromPoint:()=>[]};
 const target={classList:{contains:()=>false},closest:selector=>selector==='.scene-page'?{}:selector==='[data-scene-node]'?nodeElement('one'):null};
 const event={pointerId:1,button:0,clientX:0,clientY:0,altKey:true,target,preventDefault(){}};`,ctx);
 const start=studioSource.indexOf(" root.addEventListener('pointerdown'");const end=studioSource.indexOf(" root.addEventListener('dragstart'",start);
 vm.runInContext(studioSource.slice(start,end),ctx);return {ctx,run:s=>vm.runInContext(s,ctx)};
}
test('Alt drag duplicates a whole subtree only after movement, captures on stable root, and commits once',()=>{
 const h=gestureHarness();h.run('handlers.pointerdown(event)');assert.equal(h.run('page().children.length'),1);h.run('handlers.pointermove({...event,clientX:1})');assert.equal(h.run('page().children.length'),1);
 h.run('handlers.pointermove({...event,clientX:30,clientY:40})');assert.equal(h.run('page().children.length'),2);assert.equal(h.run('history.length'),1);assert.equal(h.run('captures'),1);
 assert.equal(h.run('entry("one").node.x'),10);assert.equal(h.run('entry(selected[0]).node.x'),40);assert.notEqual(h.run('entry(selected[0]).node.children[0].id'),'child');
 h.run('handlers.pointermove({...event,clientX:50,clientY:60});handlers.pointerup()');assert.equal(h.run('page().children.length'),2);assert.equal(h.run('commits'),1);assert.equal(h.run('history.length'),1);assert.equal(h.run('entry(selected[0]).node.y'),80);
});
test('cancelled Alt drag restores originals and IDs; Alt click alone leaves the scene untouched',()=>{
 const h=gestureHarness();h.run('handlers.pointerdown(event);handlers.pointerup()');assert.equal(h.run('page().children.length'),1);assert.equal(h.run('history.length'),0);
 h.run('handlers.pointerdown(event);handlers.pointermove({...event,clientX:30});handlers.pointercancel()');assert.equal(h.run('page().children.length'),1);assert.equal(h.run('selected[0]'),'one');assert.equal(h.run('history.length'),0);assert.equal(h.run('commits'),0);
});
test('selection cloning avoids duplicating descendants twice and preserves the original fixed anchor',()=>{
 const p={id:'p',children:[createSceneNode('frame',{id:'f',position:'fixed',anchor:'bottom-right',insetBottom:20,children:[createSceneNode('icon',{id:'i',iconName:'home-01'})]})]};
 const ids=duplicateSceneSelection(p,['f','i']);assert.equal(ids.length,1);assert.equal(p.children.length,2);assert.equal(p.children[1].insetBottom,20);assert.equal(p.children[0].children[0].id,'i');assert.notEqual(p.children[1].children[0].id,'i');
});
