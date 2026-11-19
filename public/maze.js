import { makeTool, makeWeapon, makeRPG, makeCamera } from './tools.js';
import * as THREE from 'three';
import { CELL, gridFor, layout, entryFor, doorFor, isSafe, limitFor } from './layout.js';

const WALL=0x574a3f,FLOOR=0x36302a,CEIL=0x2b2521,CORRIDOR=0x41372f;
export const WEAPON_COLORS={akA:0x9c2b1c,akB:0x1f4f9c};
export const PICKUPS=['hammer','crowbar','akA','akB','rpg','cameraA','cameraB'];

export function createMaze(n=gridFor(false),seed=0){
 const group=new THREE.Group(),walls=[],items={},half=(n-1)/2,entry=entryFor(n),size=n*CELL+2;
 const cache=new Map();
 function material(color,metalness=0){const key=`${color}:${metalness}`;if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial({color,roughness:.95,metalness}));return cache.get(key)}
 function box(w,h,d,x,y,z,color,parent=group,metalness=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,metalness));mesh.position.set(x,y,z);parent.add(mesh);return mesh}
 const wallDefs=[];
 function wall(x,z,w,d){wallDefs.push({x,z,w,d});walls.push({x,z,w,d})}
 function sphere(parent,r,color,x,y,z){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),material(color,.3));mesh.position.set(x,y,z);parent.add(mesh);return mesh}
 box(size,.2,size,0,-.1,0,FLOOR);box(size,.2,size,0,3.6,0,CEIL);
 const cells=layout(n,seed),center=Math.floor(n*n/2);let lampCount=0;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,cx=(x-half)*CELL,cz=(z-half)*CELL;
  if(!cells[i].open[0]){if(i===center){wall(cx-1.5,cz-2,.95,.18);wall(cx+1.5,cz-2,.95,.18);box(1.9,.6,.18,cx,3.3,cz-2,WALL)}else wall(cx,cz-2,CELL,.18)}
  if(!cells[i].open[3])wall(cx-2,cz,.18,CELL);
  if(z===n-1)wall(cx,cz+2,CELL,.18);if(x===n-1)wall(cx+2,cz,.18,CELL);
  if((x+z)%2===0){box(1.1,.04,.22,cx,3.48,cz,0x5e170d);box(1.0,.02,.12,cx,3.455,cz,0xb8301a)}
  if(lampCount<4&&x%5===0&&z%5===0){const lamp=new THREE.PointLight(0xff5a26,6,15,1.5);lamp.position.set(cx,3.15,cz);group.add(lamp);lampCount++}
 }
 // One instanced mesh per material keeps a 17x17 maze cheap enough for a phone.
 if(wallDefs.length){
  const geometry=new THREE.BoxGeometry(1,1,1),matrix=new THREE.Matrix4();
  const body=new THREE.InstancedMesh(geometry,material(WALL),wallDefs.length),strip=new THREE.InstancedMesh(geometry,material(CORRIDOR),wallDefs.length);
  wallDefs.forEach((w,i)=>{
   matrix.makeScale(w.w,3.6,w.d);matrix.setPosition(w.x,1.8,w.z);body.setMatrixAt(i,matrix);
   matrix.makeScale(w.w,.1,w.d);matrix.setPosition(w.x,.05,w.z);strip.setMatrixAt(i,matrix)});
  body.instanceMatrix.needsUpdate=true;strip.instanceMatrix.needsUpdate=true;
  group.add(body,strip);
 }
 // The lift square is the only safe ground; it is a small three-step box.
 for(let x=-1.5;x<=1.5;x+=1)for(let z=-1.5;z<=1.5;z+=1)box(1.02,.016,1.02,entry.x+x,.016,entry.z+z,0x3f5a3c);
 box(3.3,.03,.12,entry.x,.03,entry.z-1.6,0x76e08a);box(3.3,.03,.12,entry.x,.03,entry.z+1.6,0x76e08a);
 box(.12,.03,3.3,entry.x-1.65,.03,entry.z,0x76e08a);box(.12,.03,3.3,entry.x+1.65,.03,entry.z,0x76e08a);
 // Rules board on the south wall next to the lift.
 const signZ=((n-1)/2)*CELL+CELL/2-.14;
 box(2.4,2.9,.08,entry.x-2.6,1.45,signZ,0x2b2320);box(1.9,2.55,.08,entry.x-2.6,1.28,signZ-.03,0x171310);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#1c0d0b';ctx.fillRect(0,0,512,256);ctx.fillStyle='#ff5a2b';ctx.textAlign='center';ctx.font='bold 62px Arial';ctx.fillText('ПРАВИЛА',256,96);
 const coop=n>=15;
 ctx.font='30px Arial';ctx.fillStyle='#e8c9b6';ctx.fillText(coop?'Вдвоём: 4 предмета':'Один: 3 предмета',256,158);ctx.fillText(coop?'Оружие у каждого своё':'Не шуми, он слышит',256,200);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.74),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));
 sign.position.set(entry.x-2.6,1.65,signZ-.08);sign.rotation.y=Math.PI;group.add(sign);
 // Wall mounted CCTV cameras in the far corners. They are the eyes of the maze.
 const cameras=[];
 const corners=[[1,1],[n-2,1],[1,n-2],[n-2,n-2]];
 corners.forEach(([cx,cz],index)=>{
  const x=(cx-half)*CELL, z=(cz-half)*CELL;   // mounted at the top of the corner cell
  const housing=new THREE.Group();group.add(housing);
  const shell=new THREE.Mesh(new THREE.BoxGeometry(.26,.18,.46),material(0x1a1c1e,.4));housing.add(shell);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(.3,.05,.5),material(0x121415,.3));hood.position.y=.12;housing.add(hood);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.1,14),new THREE.MeshStandardMaterial({color:0x0b1114,metalness:.9,roughness:.15}));
  glass.rotation.x=Math.PI/2;glass.position.z=.24;housing.add(glass);
  const led=new THREE.Mesh(new THREE.SphereGeometry(.014,8,6),new THREE.MeshStandardMaterial({color:0x6d1208,emissive:0xff2a08,emissiveIntensity:.45}));
  led.position.set(.09,.07,.16);housing.add(led);
  const target=new THREE.Vector3(0,1.1,0);
  housing.position.set(x,3.02,z);housing.lookAt(target);
  const camera=new THREE.PerspectiveCamera(64,16/9,.1,70);camera.position.set(x,3.05,z);
  const dir=target.clone().sub(new THREE.Vector3(x,3.05,z)).normalize();
  camera.position.addScaledVector(dir,.3);
  camera.lookAt(target);
  cameras.push({label:`КАМЕРА ${index+1}`,camera,group:housing});
 });
 // One central door with a solid wall behind it: opening it teleports to level three.
 const door=doorFor();
 // A shallow lit chamber sits behind the doorway, so an opened door leads somewhere.
 box(2.2,3.2,.12,door.x,1.6,door.z-.62,0x241a16);
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.7),new THREE.MeshBasicMaterial({color:0x8c1206}));
 glow.position.set(door.x,1.45,door.z-.55);group.add(glow);
 const glowLight=new THREE.PointLight(0xff3a12,7,7,1.6);glowLight.position.set(door.x,1.6,door.z-.35);group.add(glowLight);
 wall(door.x,door.z-.34,2.15,.15);
 box(.12,2.9,.22,door.x-1,1.45,door.z,0x30251d);box(.12,2.9,.22,door.x+1,1.45,door.z,0x30251d);box(2.12,.12,.22,door.x,2.9,door.z,0x30251d);
 // The leaf and the boards are single sided: from the far corridor you see a plain wall.
 items.door=new THREE.Group();items.door.position.set(door.x-.9,0,door.z);group.add(items.door);
 const leafMat=new THREE.MeshStandardMaterial({color:0x453322,roughness:.8,side:THREE.FrontSide});
 const leaf=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.7),leafMat);leaf.position.set(.9,1.35,.08);items.door.add(leaf);
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.2),new THREE.MeshStandardMaterial({color:0x54402b,roughness:.75,side:THREE.FrontSide}));
 panel.position.set(.9,1.42,.10);items.door.add(panel);
 sphere(items.door,.06,0xc5b56c,1.52,1.17,.12);
 items.boards=new THREE.Group();group.add(items.boards);items.nails=new THREE.Group();group.add(items.nails);
 for(const [y,angle] of [[.9,.08],[1.8,-.08]]){
  const plank=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.24),new THREE.MeshStandardMaterial({color:0x3a2a1c,roughness:.9,side:THREE.FrontSide}));
  plank.position.set(door.x,y,door.z+.19);plank.rotation.z=angle;items.boards.add(plank);
  for(const x of [-.8,.8])sphere(items.nails,.045,0x8d8a7d,door.x+x,y+Math.sin(angle)*x,door.z+.18)}
 items.lamp=new THREE.PointLight(0xff5f2a,13,15,1.4);items.lamp.position.set(door.x,2.6,door.z+.9);group.add(items.lamp);

 function pickup(name){const g=new THREE.Group();group.add(g);const pedestal=box(.8,.12,.8,0,.06,0,0x2f2a24,g);pedestal.name='pedestal';
  const model=name==='hammer'||name==='crowbar'?makeTool(name)
   :name==='rpg'?makeRPG()
   :name==='cameraA'||name==='cameraB'?makeCamera()
   :makeWeapon(WEAPON_COLORS[name]||0x9c2b1c);
  model.name='tool';model.position.y=.15;g.add(model);g.visible=false;return g}
 for(const name of PICKUPS)items[name]=pickup(name);
 return {group,walls,items,cameras,n,entry,door,cells}
}

export function placeSpots(maze,spots){
 for(const spot of spots){
  const g=maze.items[spot.name];if(!g)continue;
  const pedestal=g.getObjectByName('pedestal'),model=g.getObjectByName('tool');
  g.position.set(spot.x,0,spot.z);g.rotation.set(0,0,0);
  pedestal.visible=spot.type==='floor';model.position.set(0,.15,0);model.rotation.set(0,Math.PI/2,0);
  if(spot.type==='wall'){g.position.y=1.15;g.rotation.y=[0,Math.PI/2,Math.PI,-Math.PI/2][spot.dir]||0}
  else if(spot.type==='ceiling'){g.position.y=3.42;model.position.y=0;model.rotation.x=Math.PI/2}
  g.visible=true
 }
}
export function updateMaze(maze,p){
 for(const name of PICKUPS)if(maze.items[name])maze.items[name].visible=!p[name];
 maze.items.nails.visible=!p.nails;maze.items.boards.visible=!p.boards;maze.items.door.rotation.y=p.door?-1.35:0;
 maze.items.lamp.intensity=p.door?14:9;
}
export function canWalk(walls,x,z){return !walls.some(w=>Math.abs(x-w.x)<w.w/2+.27&&Math.abs(z-w.z)<w.d/2+.27)}
export {isSafe,limitFor};
