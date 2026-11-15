import * as THREE from 'three';
export const MAZE_LIMIT=17.6, ENTRY={x:0,z:16}, HAMMER={x:-16,z:-16}, CROWBAR={x:16,z:-16}, DOOR={x:0,z:-2};
export function createMaze() {
 const group=new THREE.Group(),walls=[],items={};
 const cache=new Map();function material(c){if(!cache.has(c))cache.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.92}));return cache.get(c)}
 function box(w,h,d,x,y,z,c,parent=group){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);parent.add(m);return m}
 function wall(x,z,w,d){box(w,3.4,d,x,1.7,z,0xbbaa66);box(w,.12,d,x,.06,z,0x80724c);walls.push({x,z,w,d})}
 box(36,.2,36,0,-.1,0,0x9c9061);box(36,.2,36,0,3.5,0,0xc9ba81);
 // Deterministic depth-first maze. All 81 cells are connected, and one central
 // wall is reserved for the boarded door rather than being accidentally opened.
 const n=9, dirs=[[0,-1],[1,0],[0,1],[-1,0]],cells=Array.from({length:n*n},()=>({seen:false,open:[false,false,false,false]}));
 let seed=49371;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const stack=[80];cells[80].seen=true;
 while(stack.length){const i=stack[stack.length-1],x=i%n,z=Math.floor(i/n),options=[];for(let d=0;d<4;d++){const nx=x+dirs[d][0],nz=z+dirs[d][1],j=nz*n+nx;if(nx<0||nx>=n||nz<0||nz>=n||cells[j].seen)continue;if((i===40&&j===31)||(i===31&&j===40))continue;options.push([d,j])}if(!options.length){stack.pop();continue}const [d,j]=options[Math.floor(rand()*options.length)];cells[i].open[d]=true;cells[j].open[(d+2)%4]=true;cells[j].seen=true;stack.push(j)}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,cx=(x-4)*4,cz=(z-4)*4;
  if(!cells[i].open[0]){if(i===40){wall(cx-1.55,cz-2,.9,.18);wall(cx+1.55,cz-2,.9,.18);box(2.2,.55,.18,cx,3.125,cz-2,0xbbaa66)}else wall(cx,cz-2,4,.18)}
  if(!cells[i].open[3])wall(cx-2,cz,.18,4);
  if(z===n-1)wall(cx,cz+2,4,.18);if(x===n-1)wall(cx+2,cz,.18,4);
  if((x+z)%2===0){box(1.45,.035,.3,cx,3.37,cz,0xf1e8bd);}
 }
 // A real panel attached to the south wall by the entry.
 box(2.4,2.9,.08,0,1.45,17.86,0x555650);box(1.9,2.55,.08,0,1.28,17.79,0x333937);
 box(1.5,.95,.08,-2,1.65,17.86,0x54482f);box(1.34,.79,.035,-2,1.65,17.79,0xe8d99c);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#e8d99c';ctx.fillRect(0,0,512,256);ctx.fillStyle='#4b4021';ctx.textAlign='center';ctx.font='bold 70px Arial';ctx.fillText('ПРАВИЛА',256,105);ctx.font='34px Arial';ctx.fillText('Нажми кнопку рядом',256,170);const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.74),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));sign.position.set(-2,1.65,17.765);sign.rotation.y=Math.PI;group.add(sign);
 // Hinged central door in the reserved wall; its boards are on the accessible south face.
 box(.12,2.85,.22,-1,1.425,-2,0x5b503c);box(.12,2.85,.22,1,1.425,-2,0x5b503c);box(2.12,.12,.22,0,2.85,-2,0x5b503c);
 items.door=new THREE.Group();items.door.position.set(-.9,0,-2);group.add(items.door);box(1.8,2.65,.12,.9,1.325,0,0x6b573d,items.door);box(1.4,2.2,.025,.9,1.4,.07,0x7e6849,items.door);sphere(items.door,.06,0xc5b56c,1.52,1.17,.1);
 items.boards=new THREE.Group();group.add(items.boards);items.nails=new THREE.Group();group.add(items.nails);
 for(const [y,angle] of [[.9,.08],[1.8,-.08]]){const plank=box(2.1,.22,.09,0,y,-1.88,0x674628,items.boards);plank.rotation.z=angle;for(const x of [-.72,.72])sphere(items.nails,.042,0xbab6a5,x,y+Math.sin(angle)*x,-1.82)}
 function sphere(parent,r,col,x,y,z){const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,10),material(col));m.position.set(x,y,z);parent.add(m);return m}
 function cylinder(parent,r1,r2,h,col,x,y,z,rz=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,14),material(col));m.position.set(x,y,z);m.rotation.z=rz;parent.add(m);return m}
 function tool(x,z,type){const g=new THREE.Group();g.position.set(x,0,z);group.add(g);box(.8,.12,.8,0,.06,0,0x655a43,g);cylinder(g,.045,.06,.65,type==='hammer'?0x91683d:0x8a3c28,0,.47,0,-.18);if(type==='hammer'){cylinder(g,.095,.095,.38,0x9b9e98,.07,.78,0,Math.PI/2);box(.09,.13,.16,-.14,.78,0,0x777d79,g);const claw=box(.23,.045,.07,.28,.8,0,0x777d79,g);claw.rotation.z=-.4}else{cylinder(g,.045,.045,.3,0x8d918f,.08,.86,0,-.18);const hook=box(.24,.07,.09,.16,1.02,0,0x8d918f,g);hook.rotation.z=.42;box(.08,.1,.08,.25,.99,0,0x8d918f,g)}return g}
 items.hammer=tool(HAMMER.x,HAMMER.z,'hammer');items.crowbar=tool(CROWBAR.x,CROWBAR.z,'crowbar');
 return {group,walls,items};
}
export function updateMaze(maze,p){maze.items.hammer.visible=!p.hammer;maze.items.crowbar.visible=!p.crowbar;maze.items.nails.visible=!p.nails;maze.items.boards.visible=!p.boards;maze.items.door.rotation.y=p.door?-1.2:0;}
export function canWalk(walls,x,z){return !walls.some(w=>Math.abs(x-w.x)<w.w/2+.27&&Math.abs(z-w.z)<w.d/2+.27)}
