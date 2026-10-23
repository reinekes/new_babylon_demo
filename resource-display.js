import {RESOURCE_NAMES} from './definitions.js';
// Display-only entries also include local supplies that never enter warehouses.
export const DISPLAY_RESOURCE_NAMES=Object.freeze({...RESOURCE_NAMES,water:'вода'});
export const resourceLabel=key=>{const name=Object.hasOwn(DISPLAY_RESOURCE_NAMES,key)?DISPLAY_RESOURCE_NAMES[key]:'неизвестный ресурс';return name[0].toUpperCase()+name.slice(1);};
export const resourceUnits=Object.freeze({food:'еды',clay:'глины',reed:'тростника',water:'воды',wood:'дерева',stone:'камня',hides:'шкур',wool:'шерсти',cloth:'ткани',clothing:'одежды',brick:'сырцовых кирпичей',firedBrick:'обожжённых кирпичей',pottery:'керамики',beer:'напитка',faith:'веры',prestige:'престижа'});
