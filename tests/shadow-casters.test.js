import test from 'node:test';import assert from 'node:assert/strict';import {createActorShadowFilter,createOverviewShadowCadence,shadowCasterInside} from '../game3d/shadow-casters.js';

test('overview shadow reuse alternates only on stable live views',()=>{
 const refresh=createOverviewShadowCadence(),state={buildings:[],season:0};
 const camera={alpha:1,beta:1,radius:120,target:{x:1,y:0,z:2}};
 const render=(mode='auto',enabled=true,paused=false,elapsed=.03)=>refresh(state,mode,camera,enabled,paused,elapsed);
 assert.equal(render(),true);assert.equal(render(),false);assert.equal(render(),true);
 camera.target.x++;assert.equal(render(),true);assert.equal(render(),false);
 assert.equal(render('night'),true);assert.equal(render('night',true,false,.1),true);
 assert.equal(render('night',true,true),true);assert.equal(render('night',false),true);
 assert.equal(render('night'),true);state.buildings.push({});assert.equal(render('night'),true);
});
test('small-person shadow uses only the proxy, then switches back to authored rig on zoom/focus',()=>{
 const root={simplifiedShadow:true},model={parent:root},mesh={parent:model,isEnabled:()=>true,isDisposed:()=>false},proxy={parent:root,shadowProxy:true,isEnabled:()=>true,isDisposed:()=>false},accept=createActorShadowFilter();
 assert.equal(accept(mesh),false);assert.equal(accept(proxy),true);
 root.simplifiedShadow=false;assert.equal(accept(mesh),true);assert.equal(accept(proxy),false);
 assert.equal(accept({...mesh,isEnabled:()=>false}),false);
 assert.equal(accept({...proxy,isDisposed:()=>true}),false);
});
test('fauna and unknown meshes retain normal shadows',()=>{
 assert.equal(createActorShadowFilter()({isEnabled:()=>true,isDisposed:()=>false}),true);
});
test('underwater decorative fish do not enter the land shadow pass; other fauna keep their shadows',()=>{
 const accept=createActorShadowFilter(),fish={metadata:{animalKind:'fish'}},goat={metadata:{animalKind:'goat'}};
 const part=parent=>({parent,isEnabled:()=>true,isDisposed:()=>false});
 assert.equal(accept(part({parent:fish})),false);assert.equal(accept(part({parent:goat})),true);
});
test('rigid frozen casters are excluded only when their whole bound misses a shadow plane',()=>{
 const planes=[{normal:{x:1,y:0,z:0},dotCoordinate:p=>p.x}];
 const mesh={isWorldMatrixFrozen:true,getBoundingInfo:()=>({boundingBox:{centerWorld:{x:-4,y:0,z:0},extendSizeWorld:{x:2,y:8,z:8}}})};
 assert.equal(shadowCasterInside(mesh,planes),false);
 assert.equal(shadowCasterInside({...mesh,skeleton:{}},planes),true);
 assert.equal(shadowCasterInside({...mesh,isWorldMatrixFrozen:false},planes),true);
 assert.equal(shadowCasterInside({...mesh,sourceMesh:{morphTargetManager:{}}},planes),true);
 planes[0].dotCoordinate=()=>-2.8;
 assert.equal(shadowCasterInside(mesh,planes),true);
});
