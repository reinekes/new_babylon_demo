// Preserve readout nodes (including SVG icons) when their displayed data is unchanged.
const rendered=new WeakMap();
export function setHTML(element,html){
 const previous=rendered.get(element);
 if(previous?.html===html&&previous.firstChild===element.firstChild)return false;
 element.innerHTML=html;
 rendered.set(element,{html,firstChild:element.firstChild});return true;
}
