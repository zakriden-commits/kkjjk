import * as THREE from 'three';
export function createMonster(){
 const group=new THREE.Group(),figure=new THREE.Group();group.add(figure);const mats=new Map();function mat(c){if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));return mats.get(c)}
 function ell(parent,c,x,y,z,sx,sy,sz){const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
 function part(parent,c,x,y,z,r,len){const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,5,12),mat(c));m.position.set(x,y,z);parent.add(m);return m}
 const legs=[],arms=[];for(const x of [-.15,.15]){const g=new THREE.Group();g.position.set(x,.87,0);figure.add(g);legs.push(g);part(g,0x202832,0,-.37,0,.12,.48);ell(g,0x15191a,0,-.79,-.06,.13,.08,.19)}
 ell(figure,0x28333d,0,1.27,0,.31,.48,.19);ell(figure,0x343e45,0,1.58,0,.34,.18,.20);
 for(const x of [-.38,.38]){const g=new THREE.Group();g.position.set(x,1.58,0);figure.add(g);arms.push(g);part(g,0x29333d,0,-.27,0,.1,.32);ell(g,0xc1b6a5,0,-.53,0,.09,.11,.08)}
 ell(figure,0xe0d9ca,0,1.89,0,.21,.25,.18);ell(figure,0x3d3a34,0,2.06,.015,.215,.09,.18);for(const x of [-.08,.08])ell(figure,0x1b1d1b,x,1.94,-.169,.04,.025,.015);ell(figure,0x8b857d,0,1.8,-.17,.06,.008,.008);
 const blade=new THREE.Group();blade.position.set(0,-.51,0);arms[1].add(blade);part(blade,0x39322a,0,-.08,0,.035,.12);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.055,-.16,0,.055,-.16,0,.065,-.66,0,.0,-.75,0,-.045,-.66,0],3));geometry.setIndex([0,1,2,0,2,4,4,2,3]);geometry.computeVertexNormals();blade.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xa9b0aa,metalness:.8,roughness:.35,side:THREE.DoubleSide})));
 return {group,figure,legs,arms,phase:0};
}
export function animateMonster(m,dt,moving){if(moving)m.phase+=dt*7;const swing=moving?Math.sin(m.phase):0;m.legs[0].rotation.x=swing*.4;m.legs[1].rotation.x=-swing*.4;m.arms[0].rotation.x=-swing*.25;m.arms[1].rotation.x=-.2+swing*.15;m.figure.rotation.z=Math.sin(m.phase*.5)*.025}
