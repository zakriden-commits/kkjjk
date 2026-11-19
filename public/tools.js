import * as THREE from 'three';
const steel=new THREE.MeshStandardMaterial({color:0xa7a9a2,metalness:.8,roughness:.3}), dark=new THREE.MeshStandardMaterial({color:0x565d5c,metalness:.65,roughness:.4}),wood=new THREE.MeshStandardMaterial({color:0x8b603d,roughness:.9}),red=new THREE.MeshStandardMaterial({color:0x882e24,metalness:.35,roughness:.55});
function cyl(parent,r1,r2,h,mat,x,y,z,rz=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),mat);m.position.set(x,y,z);m.rotation.z=rz;parent.add(m);return m}
function tube(parent,points,r,mat){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(curve,28,r,8,false),mat);parent.add(m);return m}
export function makeTool(type){const g=new THREE.Group();if(type==='hammer'){cyl(g,.036,.052,.68,wood,0,.34,0);cyl(g,.10,.095,.35,steel,0,.71,0,Math.PI/2);cyl(g,.105,.105,.025,dark,-.19,.71,0,Math.PI/2);for(const z of [-.045,.045])tube(g,[[.16,.71,z],[.25,.72,z],[.31,.67,z],[.34,.59,z]],.023,dark)}else{cyl(g,.04,.043,.61,red,0,.35,0);tube(g,[[0,.63,0],[0,.76,0],[.035,.84,0],[.12,.87,0],[.18,.83,0]],.04,steel);for(const z of [-.028,.028])tube(g,[[.17,.83,z],[.22,.77,z],[.25,.73,z]],.016,dark);tube(g,[[0,.06,0],[-.03,.01,0],[-.11,0,0]],.04,steel)}return g}

// AK-47 built from simple parts: dark receiver, wooden furniture in the owner colour.
export function makeWeapon(color=0x8f2f22){
 const g=new THREE.Group(),body=new THREE.MeshStandardMaterial({color,roughness:.5}),wood=new THREE.MeshStandardMaterial({color:0x6b4526,roughness:.85}),
  metal=new THREE.MeshStandardMaterial({color:0x2f3334,metalness:.8,roughness:.35}),black=new THREE.MeshStandardMaterial({color:0x16191a,roughness:.6});
 const plate=(w,h,d,mat,x,y,z,rz=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.z=rz;g.add(m);return m};
 const tube=(r,len,mat,x,y,z,rz=0)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);m.rotation.x=Math.PI/2;m.rotation.z=rz;m.position.set(x,y,z);g.add(m);return m};
 plate(.07,.11,.40,metal,0,.02,.02);            // receiver
 plate(.06,.06,.26,metal,0,.08,-.02);           // dust cover
 plate(.055,.02,.26,black,0,.105,-.02);         // top rail
 plate(.06,.05,.16,wood,0,.085,.10);            // upper handguard
 plate(.07,.06,.24,wood,0,-.005,.24);           // lower handguard
 plate(.05,.10,.24,wood,0,.02,-.26,.06);        // stock
 plate(.03,.03,.10,metal,0,.02,-.38);           // butt plate
 plate(.055,.15,.08,wood,0,-.075,.03,-.22);     // pistol grip
 const mag=new THREE.Group();g.add(mag);
 for(let i=0;i<4;i++){const p=plate(.05,.05,.07,metal,0,-.02-i*.045,.10+i*.028,-.32-i*.12);mag.add(p)}
 tube(.013,.46,metal,0,.045,.46);               // barrel
 tube(.02,.10,metal,0,.045,.72);                // muzzle brake
 plate(.02,.05,.03,metal,0,.115,.60);           // front sight post
 plate(.02,.04,.05,metal,0,.12,.05);            // rear sight
 plate(.02,.02,.20,metal,.055,.02,.10);         // side rail
 tube(.02,.06,metal,.02,-.08,.20);              // sling loop
 // trigger guard, bolt and sling keep it from looking like plain boxes
 const guard=new THREE.Mesh(new THREE.TorusGeometry(.045,.008,6,12,Math.PI),metal);guard.rotation.set(Math.PI/2,0,Math.PI);guard.position.set(0,-.12,.05);g.add(guard);
 const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.09,8),metal);bolt.rotation.z=Math.PI/2;bolt.position.set(.06,.03,-.02);g.add(bolt);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(.02,8,6),metal);knob.position.set(.11,.03,-.02);g.add(knob);
 g.scale.setScalar(1.05);
 return g;
}

// RPG-7: wide tube, cone warhead, wooden grips.
export function makeRPG(){
 const g=new THREE.Group(),green=new THREE.MeshStandardMaterial({color:0x4c5a34,roughness:.7,metalness:.2}),
  dark=new THREE.MeshStandardMaterial({color:0x2a2f22,roughness:.6}),metal=new THREE.MeshStandardMaterial({color:0x51565a,metalness:.7,roughness:.4}),
  wood=new THREE.MeshStandardMaterial({color:0x6b4526,roughness:.85}),red=new THREE.MeshStandardMaterial({color:0x8f2f22,roughness:.55});
 const tube=(r,len,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,16),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m};
 tube(.075,1.05,dark,0,0,.05);                 // main tube
 tube(.085,.18,green,0,0,-.45);                // rear flare
 const cone=new THREE.Mesh(new THREE.CylinderGeometry(.02,.16,.34,16),green);cone.rotation.x=Math.PI/2;cone.position.set(0,0,.70);g.add(cone);
 const nose=new THREE.Mesh(new THREE.CylinderGeometry(.005,.02,.12,12),metal);nose.rotation.x=Math.PI/2;nose.position.set(0,0,.92);g.add(nose);
 const grip=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wood);m.position.set(x,y,z);g.add(m);return m};
 grip(.05,.16,.06,0,-.12,-.16);grip(.05,.14,.06,0,-.11,.12);
 const sight=new THREE.Mesh(new THREE.BoxGeometry(.03,.10,.05),metal);sight.position.set(0,.12,.02);g.add(sight);
 const band=new THREE.Mesh(new THREE.TorusGeometry(.078,.012,8,18),red);band.position.set(0,0,.22);g.add(band);
 for(const z of [-.28,-.08,.14]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.079,.008,6,16),dark);ring.position.set(0,0,z);g.add(ring)}
 const trigger=new THREE.Mesh(new THREE.TorusGeometry(.03,.006,6,10,Math.PI),metal);trigger.rotation.set(Math.PI/2,0,Math.PI);trigger.position.set(0,-.16,.02);g.add(trigger);
 const frontSight=new THREE.Mesh(new THREE.BoxGeometry(.02,.09,.02),metal);frontSight.position.set(0,.11,.34);g.add(frontSight);
 g.scale.setScalar(.95);
 return g;
}

// A small body camera: box, lens and a red LED.
export function makeCamera(){
 const g=new THREE.Group(),shell=new THREE.MeshStandardMaterial({color:0x24282b,metalness:.5,roughness:.5}),
  lens=new THREE.MeshStandardMaterial({color:0x101517,metalness:.9,roughness:.15}),led=new THREE.MeshStandardMaterial({color:0xff3b12,emissive:0xff2a08,emissiveIntensity:1.4});
 const body=new THREE.Mesh(new THREE.BoxGeometry(.20,.13,.16),shell);g.add(body);
 const glass=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.05,16),lens);glass.rotation.x=Math.PI/2;glass.position.set(0,0,.10);g.add(glass);
 const dot=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),led);dot.position.set(.07,.07,.06);g.add(dot);
 const mount=new THREE.Mesh(new THREE.BoxGeometry(.06,.03,.06),shell);mount.position.set(0,-.08,.02);g.add(mount);
 return g;
}
