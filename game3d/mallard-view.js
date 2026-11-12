import {createGame} from '../engine.js';
import {createGameRenderer} from './renderer.js';

const canvas=document.querySelector('#city');
const status=document.querySelector('#status');
const pause=document.querySelector('#pause');
const focus=document.querySelector('#focus');
const state=createGame({start:'established',seed:137});
const renderer=await createGameRenderer(canvas,()=>{},{initialState:state});
if(renderer.mode==='3d'){
 renderer.lightMode='day';
 let paused=true,following=false,birds=[],last=null;
 const center=renderer.B.Vector3.Zero();
 const midpoint=()=>{
  center.setAll(0);
  for(const bird of birds)center.addInPlace(bird.position);
  center.scaleInPlace(1/birds.length);
  center.y=.02;
  return center;
 };
 const draw=now=>{
  if(!paused&&last!==null)state.simTime+=Math.min(.1,(now-last)/1000);
  last=now;
  if(following)renderer.B.Vector3.LerpToRef(renderer.camera.target,midpoint(),.12,renderer.camera.target);
  renderer.draw(state,null,now,{paused,speed:1});
  requestAnimationFrame(draw);
 };
 requestAnimationFrame(draw);
 await renderer.detailsReady;
 birds=renderer.scene.transformNodes.filter(node=>node.metadata?.shoreFocus);
 const shore=birds[0]?.metadata.shoreFocus;
 if(shore){
  focus.onclick=()=>{
   renderer.focusOn(shore.x,shore.z);
   renderer.camera.setTarget(midpoint().clone());
   renderer.camera.alpha=shore.angle+.3;
   renderer.camera.beta=1.16;
   renderer.camera.lowerRadiusLimit=4.5;
   renderer.camera.radius=5.8*Math.max(1,.88*innerHeight/innerWidth);
   following=true;
  };
  for(const event of ['pointerdown','wheel'])canvas.addEventListener(event,()=>{following=false;},{passive:true});
  focus.onclick();
  pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Продолжить':'Пауза';};
  focus.disabled=pause.disabled=false;
  paused=false;
  status.textContent='Селезень и самка · прогулка и плавание';
 }else status.textContent='Кряквы на этом берегу недоступны.';
}else status.textContent='Для просмотра берега нужен WebGL.';
