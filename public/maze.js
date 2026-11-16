import { makeTool } from './tools.js';
import * as THREE from 'three';
import { GRID, layout, ENTRY } from './layout.js';
export { MAZE_LIMIT, ENTRY, HAMMER, CROWBAR, DOOR } from './layout.js';
export function createMaze() {
 const group=new THREE.Group(),walls=[],items={};
 const cache=new Map();function material(c){if(!cache.has(c))cache.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.92}));return cache.get(c)}
 function box(w,h,d,x,y,z,c,parent=group){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);parent.add(m);return m}
 function wall(x,z,w,d){box(w,3.4,d,x,1.7,z,0x8f8351);box(w,.12,d,x,.06,z,0x80724c);walls.push({x,z,w,d})}
 box(44,.2,44,0,-.1,0,0x81764c);box(44,.2,44,0,3.5,0,0xa69a65);
 // Deterministic depth-first maze. All cells are connected, and one central
 // wall is reserved for the boarded door rather than being accidentally opened.
 const n=GRID,cells=layout(),center=Math.floor(n*n/2),half=(n-1)/2;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,cx=(x-half)*4,cz=(z-half)*4;
  if(!cells[i].open[0]){if(i===center){wall(cx-1.55,cz-2,.9,.18);wall(cx+1.55,cz-2,.9,.18);box(2.2,.55,.18,cx,3.125,cz-2,0x8f8351)}else wall(cx,cz-2,4,.18)}
  if(!cells[i].open[3])wall(cx-2,cz,.18,4);
  if(z===n-1)wall(cx,cz+2,4,.18);if(x===n-1)wall(cx+2,cz,.18,4);
  if((x+z)%2===0){box(1.45,.035,.3,cx,3.37,cz,0xf1e8bd);}
 }
 // The green floor marks the same expanded safe zone used by the server.
 box(12,.012,8,0,.012,18,0x567755);
 // A real panel attached to the south wall by the entry.
 box(2.4,2.9,.08,0,1.45,21.86,0x555650);box(1.9,2.55,.08,0,1.28,21.79,0x333937);
 box(1.5,.95,.08,-1,1.65,21.86,0x54482f);box(1.34,.79,.035,-1,1.65,21.79,0xe8d99c);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#e8d99c';ctx.fillRect(0,0,512,256);ctx.fillStyle='#4b4021';ctx.textAlign='center';ctx.font='bold 70px Arial';ctx.fillText('ПРАВИЛА',256,105);ctx.font='34px Arial';ctx.fillText('Нажми кнопку рядом',256,170);const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.74),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));sign.position.set(-1,1.65,21.765);sign.rotation.y=Math.PI;group.add(sign);
 // One central door; a solid wall behind it leads to a teleport, not another corridor.
 wall(0,-2.34,2.15,.15);
 // Hinged central door in the reserved wall; its boards are on the accessible south face.
 box(.12,2.85,.22,-1,1.425,-2,0x5b503c);box(.12,2.85,.22,1,1.425,-2,0x5b503c);box(2.12,.12,.22,0,2.85,-2,0x5b503c);
 items.door=new THREE.Group();items.door.position.set(-.9,0,-2);group.add(items.door);box(1.8,2.65,.12,.9,1.325,0,0x6b573d,items.door);box(1.4,2.2,.025,.9,1.4,.07,0x7e6849,items.door);sphere(items.door,.06,0xc5b56c,1.52,1.17,.1);
 items.boards=new THREE.Group();group.add(items.boards);items.nails=new THREE.Group();group.add(items.nails);
 for(const [y,angle] of [[.9,.08],[1.8,-.08]]){const plank=box(2.1,.22,.09,0,y,-1.88,0x674628,items.boards);plank.rotation.z=angle;for(const x of [-.72,.72])sphere(items.nails,.042,0xbab6a5,x,y+Math.sin(angle)*x,-1.82)}
 function sphere(parent,r,col,x,y,z){const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,10),material(col));m.position.set(x,y,z);parent.add(m);return m}
 function cylinder(parent,r1,r2,h,col,x,y,z,rz=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,14),material(col));m.position.set(x,y,z);m.rotation.z=rz;parent.add(m);return m}
 function tool(type){const g=new THREE.Group();group.add(g);const pedestal=box(.8,.12,.8,0,.06,0,0x655a43,g);pedestal.name='pedestal';const tool=makeTool(type);tool.name='tool';tool.position.y=.15;g.add(tool);g.visible=false;return g}
 items.hammer=tool('hammer');items.crowbar=tool('crowbar');
 return {group,walls,items};
}
export function updateMaze(maze,p){maze.items.hammer.visible=!p.hammer;maze.items.crowbar.visible=!p.crowbar;maze.items.nails.visible=!p.nails;maze.items.boards.visible=!p.boards;maze.items.door.rotation.y=p.door?-1.2:0;}
export function canWalk(walls,x,z){return !walls.some(w=>Math.abs(x-w.x)<w.w/2+.27&&Math.abs(z-w.z)<w.d/2+.27)}

export function placeTools(maze,spots){for(const name of ['hammer','crowbar']){const spot=spots[name],g=maze.items[name],pedestal=g.getObjectByName('pedestal'),tool=g.getObjectByName('tool');g.position.set(spot.x,0,spot.z);g.rotation.set(0,0,0);pedestal.visible=spot.type==='floor';tool.position.set(0,.15,0);tool.rotation.set(0,0,0);if(spot.type==='wall'){g.position.y=1.1;g.rotation.y=[0,Math.PI/2,Math.PI,-Math.PI/2][spot.dir]}else if(spot.type==='ceiling'){g.position.y=3.25;tool.position.y=0;tool.rotation.x=Math.PI/2}g.visible=true}}
