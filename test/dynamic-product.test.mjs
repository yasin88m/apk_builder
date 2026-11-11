import test from 'node:test';
import assert from 'node:assert/strict';
import {demo,normalize} from '../public/model.js';
import {prepareProject,refreshTemplateProject} from '../public/project-flow.js';
import {sceneFromConfig,normalizeScene,getSceneProduct,sceneProductValue,sceneDescendants,renderScenePage} from '../public/scene.js';

const detailNodes=scene=>scene.pages.find(p=>p.id==='product-detail')?.children.flatMap(sceneDescendants)||[];
const role=nodes=>field=>nodes.find(n=>n.productField===field);

test('every starter template uses exactly one reusable product-details layout',()=>{
 for(const id of ['brewbliss','shopcart','swimshop','artstore']){
  const config=demo(id),scene=sceneFromConfig(config),pages=scene.pages.filter(p=>p.id==='product-detail');
  assert.equal(pages.length,1,id);
  assert.equal(scene.pages.filter(p=>/^item-\d+$/.test(p.id)).length,0,id);
  assert.equal(scene.products.length,config.items.length);
  const nodes=detailNodes(scene),get=role(nodes);
  for(const field of ['title','price','description','category','image'])assert.ok(get(field),id+': '+field);
  const html=renderScenePage(pages[0]);
  for(const field of ['title','price','description','category','image'])assert.ok(html.includes('data-product-field="'+field+'"'),id+': '+field);
  // The editable template is not hard-coded with the first product.
  assert.notEqual(get('title').text,config.items[0].title);
  assert.notEqual(get('description').text,config.items[0].description);
  assert.ok(nodes.some(n=>n.action==='cart-add'&&n.itemId==='__selected__')||id==='artstore');
  for(const item of config.items){
   const selected=getSceneProduct(scene,item.id);
   assert.equal(selected.id,item.id);
   assert.equal(sceneProductValue(scene,selected,'title'),item.title);
   assert.equal(sceneProductValue(scene,selected,'price'),item.price);
   assert.equal(selected.image,item.image);
  }
  const saved=normalizeScene(JSON.parse(JSON.stringify(scene)));
  for(const field of ['title','price','description','category','image'])assert.ok(role(detailNodes(saved))(field),'round trip '+id+':'+field);
 }
});

test('coffee, sports and clothing variants bind to currently selected product, not the sample',()=>{
 for(const id of ['brewbliss','swimshop','shopcart']){
  const scene=sceneFromConfig(demo(id)),nodes=detailNodes(scene);
  assert.ok(role(nodes)('sizes'));
  assert.ok(role(nodes)('colors'));
  assert.ok(nodes.some(n=>n.action==='favorite'&&n.itemId==='__selected__'));
  assert.ok(nodes.some(n=>n.action==='variant-size'&&n.itemId==='__selected__'));
  assert.ok(nodes.some(n=>n.action==='variant-color'&&n.itemId==='__selected__'));
  const first=getSceneProduct(scene,'1'),second=getSceneProduct(scene,'2');
  assert.notEqual(first.title,second.title);
  assert.ok(Array.isArray(first.sizes)&&first.sizes.length>0);
  assert.ok(Array.isArray(second.colors)&&second.colors.length>0);
 }
});

test('editing product records updates shared details without resetting layout, pages or styles',()=>{
 const config=prepareProject(demo('brewbliss'));
 const page=config.scene.pages.find(p=>p.id==='product-detail');
 const titleNode=role(detailNodes(config.scene))('title');
 titleNode.fontSize=38;
 config.scene.origin='custom';
 const edited={...config,items:config.items.map((item,i)=>i===1?{...item,title:'مافین تازه',price:'۱۲۹٬۰۰۰ تومان',description:'مواد تازه و خوشمزه',image:'catalog:brewbliss/muffin'}:item)};
 edited.items.push({...edited.items[0],id:'new-custom',title:'محصول جدید',price:'۲۵٬۰۰۰ تومان',image:edited.items[0].image});
 const result=prepareProject(edited);
 assert.equal(result.scene.pages.length,config.scene.pages.length);
 assert.equal(result.scene.pages.find(p=>p.id==='product-detail').id,page.id);
 assert.equal(role(detailNodes(result.scene))('title').fontSize,38);
 assert.equal(getSceneProduct(result.scene,'2').title,'مافین تازه');
 assert.equal(sceneProductValue(result.scene,getSceneProduct(result.scene,'2'),'price'),'۱۲۹٬۰۰۰ تومان');
 assert.equal(getSceneProduct(result.scene,'new-custom').title,'محصول جدید');
 assert.ok(result.scene.commerce.products.some(p=>p.id==='new-custom'));
 assert.equal(result.scene.commerce.products.find(p=>p.id==='2').price,129000);
 const scenesBefore=JSON.stringify(result.scene.pages);
 refreshTemplateProject(result);
 assert.equal(JSON.stringify(result.scene.pages),scenesBefore);
});

test('the selected product ID can change without changing the shared page itself',()=>{
 const scene=sceneFromConfig(demo('brewbliss'));
 const template=JSON.stringify(scene.pages.find(p=>p.id==='product-detail'));
 scene.activeProductId='2';
 const first=getSceneProduct(scene);
 assert.equal(first.id,'2');
 assert.equal(first.title,scene.products[1].title);
 scene.activeProductId='4';
 assert.equal(getSceneProduct(scene).id,'4');
 assert.equal(JSON.stringify(scene.pages.find(p=>p.id==='product-detail')),template);
});
