import test from 'node:test';
import assert from 'node:assert/strict';
import {setHTML} from '../ui-render.js';
test('unchanged readouts retain their nodes, changed readouts refresh immediately',()=>{
 let writes=0,html='';const element={firstChild:null,set innerHTML(v){writes++;html=v;this.firstChild={};},get innerHTML(){return html;}};
 assert.equal(setHTML(element,'<b>12</b>'),true);const child=element.firstChild;
 for(let i=0;i<100;i++)assert.equal(setHTML(element,'<b>12</b>'),false);
 assert.equal(writes,1);assert.equal(element.firstChild,child);
 assert.equal(setHTML(element,'<b>13</b>'),true);assert.equal(writes,2);
 element.firstChild=null;assert.equal(setHTML(element,'<b>13</b>'),true);
});
