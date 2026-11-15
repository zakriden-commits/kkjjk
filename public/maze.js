import * as THREE from 'three';
export function createMaze() {
 const group=new THREE.Group(),walls=[],items={};
 const material=c=>new THREE.MeshStandardMaterial({color:c,roughness:.95});
 function box(w,h,d,x,y,z,c,parent=group){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);parent.add(m);return m}
 function wall(x,z,w,d){box(w,3.5,d,x,1.75,z,0xb9a95d);box(w,.12,d+.02,x,.12,z,0x8f814b);walls.push({x,z,w,d})}
 box(18,.2,18,0,-.1,0,0xa99b63);box(18,.2,18,0,3.6,0,0xd5c77d);
 wall(0,-9,18,.2);wall(0,9,18,.2);wall(-9,0,.2,18);wall(9,0,.2,18);
 // Long offset partitions form routes around the central door, with wide gaps.
 wall(-5,-3,.25,9);wall(-5,6,.25,2);wall(5,-3,.25,9);wall(5,6,.25,2);
 wall(-2,-5,5,.25);wall(3,-5,3,.25);wall(-2,4,5,.25);wall(3,4,3,.25);
 wall(-7.2,-2,1.6,.25);wall(7.2,1,1.6,.25);
 for(const x of [-6,0,6])for(const z of [-6,0,6])box(1.3,.035,.35,x,3.48,z,0xfff3bc);
 // Elevator opening and a sign by the entrance.
 box(2.5,3,.15,0,1.5,8.82,0x575955);box(1.8,2.5,.08,0,1.3,8.7,0x292e2c);
 box(1.4,.9,.12,-2,1.55,7.65,0x413d2c);box(1.26,.76,.04,-2,1.55,7.57,0xe7d88d);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#e7d88d';c.fillRect(0,0,512,256);c.fillStyle='#4b4021';c.textAlign='center';c.font='bold 70px Arial';c.fillText('ПРАВИЛА',256,105);c.font='36px Arial';c.fillText('Нажми кнопку вблизи',256,170);const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));sign.position.set(-2,1.55,7.53);group.add(sign);
 // The central door faces the entrance; the boards and four nail heads are removable.
 box(2.1,2.9,.25,0,1.45,-.15,0x514b38);items.door=box(1.65,2.55,.12,0,1.3,0,0x776640);sphere(group,.06,0xc5b56c,.6,1.18,.09);
 items.boards=new THREE.Group();group.add(items.boards);
 for(const y of [.85,1.7]){const plank=box(2.1,.23,.1,0,y,.14,0x694323,items.boards);plank.rotation.z=y===.85?.12:-.12}
 items.nails=new THREE.Group();group.add(items.nails);for(const y of [.85,1.7])for(const x of [-.73,.73])sphere(items.nails,.045,0xc8c5ac,x,y+x*(y===.85?.12:-.12),.205);
 function sphere(parent,r,col,x,y,z){const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),material(col));m.position.set(x,y,z);parent.add(m);return m}
 // Large recognisable tools, standing on their own pedestals.
 function tool(x,z,type){const g=new THREE.Group();g.position.set(x,0,z);group.add(g);box(.8,.12,.8,0,.08,0,0x63593d,g);const shaft=box(.09,.75,.09,0,.56,0,type==='hammer'?0x855028:0x555b5a,g);shaft.rotation.z=-.18;if(type==='hammer'){box(.42,.16,.16,.07,.94,0,0xaaa9a0,g);box(.13,.19,.19,-.1,.94,0,0x686d6b,g)}else{box(.1,.25,.1,.05,.96,0,0x8c9995,g);const hook=box(.28,.08,.1,.13,1.1,0,0x8c9995,g);hook.rotation.z=.35}return g}
 items.hammer=tool(-7,-6,'hammer');items.crowbar=tool(7,-6,'crowbar');
 return {group,walls,items};
}
export function updateMaze(maze,p){maze.items.hammer.visible=!p.hammer;maze.items.crowbar.visible=!p.crowbar;maze.items.nails.visible=!p.nails;maze.items.boards.visible=!p.boards;maze.items.door.rotation.y=p.door?-1.2:0;}
export function canWalk(walls,x,z){return !walls.some(w=>Math.abs(x-w.x)<w.w/2+.27&&Math.abs(z-w.z)<w.d/2+.27)}
