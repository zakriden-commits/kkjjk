import * as THREE from 'three';
const steel=new THREE.MeshStandardMaterial({color:0xa7a9a2,metalness:.8,roughness:.3}), dark=new THREE.MeshStandardMaterial({color:0x565d5c,metalness:.65,roughness:.4}),wood=new THREE.MeshStandardMaterial({color:0x8b603d,roughness:.9}),red=new THREE.MeshStandardMaterial({color:0x882e24,metalness:.35,roughness:.55});
function cyl(parent,r1,r2,h,mat,x,y,z,rz=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),mat);m.position.set(x,y,z);m.rotation.z=rz;parent.add(m);return m}
function tube(parent,points,r,mat){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(curve,28,r,8,false),mat);parent.add(m);return m}
export function makeTool(type){const g=new THREE.Group();if(type==='hammer'){cyl(g,.036,.052,.68,wood,0,.34,0);cyl(g,.10,.095,.35,steel,0,.71,0,Math.PI/2);cyl(g,.105,.105,.025,dark,-.19,.71,0,Math.PI/2);for(const z of [-.045,.045])tube(g,[[.16,.71,z],[.25,.72,z],[.31,.67,z],[.34,.59,z]],.023,dark)}else{cyl(g,.04,.043,.61,red,0,.35,0);tube(g,[[0,.63,0],[0,.76,0],[.035,.84,0],[.12,.87,0],[.18,.83,0]],.04,steel);for(const z of [-.028,.028])tube(g,[[.17,.83,z],[.22,.77,z],[.25,.73,z]],.016,dark);tube(g,[[0,.06,0],[-.03,.01,0],[-.11,0,0]],.04,steel)}return g}

// AK-47 built from simple parts: dark receiver, wooden furniture in the owner colour.
export function makeWeapon(color=0x8f2f22){
 const g=new THREE.Group(),body=new THREE.MeshStandardMaterial({color,roughness:.55}),metal=new THREE.MeshStandardMaterial({color:0x3b3f40,metalness:.75,roughness:.4});
 const plate=(w,h,d,mat,x,y,z,rz=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.z=rz;g.add(m);return m};
 const tube=(r,len,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m};
 plate(.06,.10,.34,metal,0,.03,.02);           // receiver
 plate(.05,.05,.20,metal,0,.09,-.02);          // dust cover
 plate(.05,.04,.22,body,0,-.01,.20);           // handguard
 plate(.05,.06,.16,body,0,.02,-.22);           // stock
 plate(.05,.14,.07,body,0,-.07,.03,-.25);      // pistol grip
 plate(.04,.10,.05,metal,0,-.08,.12,.22);      // magazine
 plate(.04,.10,.05,metal,0,-.17,.16,.22);
 tube(.012,.42,metal,0,.04,.42);               // barrel
 tube(.016,.16,metal,0,.055,.30);
 plate(.02,.035,.03,metal,0,.10,.58);          // front sight
 plate(.02,.03,.06,metal,0,.10,-.08);
 return g
}
