import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {advanceGenerations,COURTYARD_BIRTH_FOOD} from '../demography.js';
import {buildingKey} from '../definitions.js';
import {river} from '../world.js';
import {networkFor} from '../workforce.js';

const leftHome='8,8',rightHome='20,8';

function riversideCity(){
 const s=createGame({start:'established'});
 s.demography.birthFoodRule=COURTYARD_BIRTH_FOOD;
 s.happiness=64;
 s.buildings.push({type:'house',x:20,y:8,level:1});
 return s;
}

function residentAt(c,home){
 const [x,y]=home.split(',').map(Number);
 Object.assign(c,{home,x,y,age:24,partner:null});
 return c;
}

function homeComponent(s,home){
 const network=networkFor(s);
 const port=network.ports.find(p=>buildingKey(p.building)===home);
 const component=network.components.get(port?.key);
 assert.notEqual(component,undefined);
 return component;
}

test('unconnected banks form local families when the first candidate lives across the river',()=>{
 const s=riversideCity();
 const [leftMan,rightWoman,rightMan,leftWoman]=s.citizens.slice(0,4)
  .map((c,i)=>residentAt(c,[leftHome,rightHome,rightHome,leftHome][i]));
 assert.notEqual(homeComponent(s,leftHome),homeComponent(s,rightHome));

 advanceGenerations(s);

 assert.equal(leftMan.partner,leftWoman.id);
 assert.equal(leftWoman.partner,leftMan.id);
 assert.equal(rightMan.partner,rightWoman.id);
 assert.equal(rightWoman.partner,rightMan.id);
});

test('residents without a local partner can meet after a bridge joins the banks',()=>{
 const s=riversideCity();
 const left=residentAt(s.citizens[0],leftHome);
 const right=residentAt(s.citizens[1],rightHome);

 advanceGenerations(s);
 assert.equal(left.partner,null);
 assert.equal(right.partner,null);

 s.buildings.push({type:'bridge',x:Math.round(river(8,s)),y:8,level:1});
 assert.equal(homeComponent(s,leftHome),homeComponent(s,rightHome));
 advanceGenerations(s);
 assert.equal(left.partner,right.id);
 assert.equal(right.partner,left.id);
});

test('a broken connection preserves an existing marriage and household identities',()=>{
 const s=riversideCity();
 const left=s.citizens[0],right=s.citizens[1];
 residentAt(left,leftHome);
 residentAt(right,rightHome);
 left.partner=right.id;
 right.partner=left.id;
 const households=s.citizens.map(c=>[c.id,c.home,c.partner]);
 assert.notEqual(homeComponent(s,leftHome),homeComponent(s,rightHome));

 advanceGenerations(s);

 assert.deepEqual(s.citizens.map(c=>[c.id,c.home,c.partner]),households);
});
