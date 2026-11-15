import * as THREE from 'three';
// Smooth, lightweight stylised figures with articulated shoulders and hips.
const mats=new Map();function mat(color,metal=0){const k=`${color}:${metal}`;if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color,roughness:.75,metalness:metal}));return mats.get(k)}
function mesh(parent,geo,color,x=0,y=0,z=0,metal=0){const m=new THREE.Mesh(geo,mat(color,metal));m.position.set(x,y,z);parent.add(m);return m}
function oval(parent,color,x,y,z,sx,sy,sz){const m=mesh(parent,new THREE.SphereGeometry(1,20,14),color,x,y,z);m.scale.set(sx,sy,sz);return m}
function capsule(parent,color,x,y,z,r,len){return mesh(parent,new THREE.CapsuleGeometry(r,len,6,16),color,x,y,z)}
function cylinder(parent,color,x,y,z,r1,r2,h){return mesh(parent,new THREE.CylinderGeometry(r1,r2,h,16),color,x,y,z)}
export function createAvatar(skin){
 const bat=skin==='batman',group=new THREE.Group(),figure=new THREE.Group();group.add(figure);
 const fabric=bat?0x353e49:0x523067, shade=bat?0x171d27:0x382343;
 // Legs and boots are modelled around hip pivots to keep feet at floor level.
 const legs=[];for(const x of [-.13,.13]){const leg=new THREE.Group();leg.position.set(x,.76,0);figure.add(leg);legs.push(leg);capsule(leg,shade,0,-.31,0,.105,.38);oval(leg,bat?0x141b22:0x26232b,0,-.675,-.06,.115,.085,.18)}
 // Shaped torso and fitted shoulders, rather than a stack of cubes.
 const torso=cylinder(figure,fabric,0,1.12,0,.24,.19,.62);torso.scale.z=.7;
 oval(figure,fabric,0,1.39,0,.26,.12,.16);oval(figure,shade,0,.8,0,.21,.11,.145);
 const arms=[];for(const x of [-.32,.32]){const arm=new THREE.Group();arm.position.set(x,1.36,0);figure.add(arm);arms.push(arm);oval(arm,fabric,0,-.04,0,.12,.14,.12);capsule(arm,fabric,0,-.24,0,.085,.27);oval(arm,bat?0x171e27:0xe1ddd1,0,-.47,-.01,.09,.115,.085)}
 cylinder(figure,bat?0x272a2e:0xe2ddd1,0,1.48,0,.10,.10,.12);
 oval(figure,bat?0xc49c7c:0xe6e5dd,0,1.68,0,.205,.25,.17);
 if(bat){
  // Close-fitting cowl; exposed lower face and white eye lenses.
  oval(figure,0x161d27,0,1.74,.004,.211,.205,.175);
  oval(figure,0xc49c7c,0,1.58,-.144,.135,.078,.045);
  for(const side of [-1,1]){const ear=mesh(figure,new THREE.ConeGeometry(.053,.25,12),0x161d27,side*.135,1.96,.005);ear.rotation.z=-side*.1;const eye=oval(figure,0xe6eee5,side*.083,1.75,-.16,.058,.019,.012);eye.rotation.z=side*.18}
  const belt=cylinder(figure,0xb39849,0,.86,0,.215,.215,.095);belt.scale.z=.69;
  oval(figure,0xc8a849,0,1.22,-.148,.125,.07,.014);oval(figure,0x20242a,0,1.22,-.162,.085,.025,.008);
  // A tapered, slightly curved cape, attached at the shoulders.
  const vertices=new Float32Array([-.22,1.39,.10,.22,1.39,.10,-.31,.10,.26,.31,.10,.26,0,.07,.29]);const capeGeo=new THREE.BufferGeometry();capeGeo.setAttribute('position',new THREE.BufferAttribute(vertices,3));capeGeo.setIndex([0,2,1,1,2,3,2,4,3]);capeGeo.computeVertexNormals();const cape=new THREE.Mesh(capeGeo,new THREE.MeshStandardMaterial({color:0x171c26,side:THREE.DoubleSide,roughness:1}));cape.name='cape';figure.add(cape);
 }else{
  // Hair and face sit flush against the head; details are curves and ellipsoids.
  oval(figure,0x397b43,0,1.85,.01,.215,.105,.18);
  for(const side of [-1,1]){oval(figure,0x397b43,side*.18,1.75,.01,.055,.13,.12);oval(figure,0x29262e,side*.075,1.71,-.165,.027,.022,.012)}
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.078,.009,6,20,Math.PI),mat(0xa72f40));smile.position.set(0,1.605,-.169);smile.rotation.z=Math.PI;figure.add(smile);
  const vest=cylinder(figure,0x718342,0,1.12,-.092,.12,.1,.49);vest.scale.z=.35;
  oval(figure,0xe8e2d3,0,1.33,-.153,.075,.10,.012);const tie=cylinder(figure,0x774097,0,1.25,-.166,.025,.018,.16);tie.scale.z=.5;
  for(let i=0;i<3;i++)oval(figure,0xd0b878,.03,1.13-i*.075,-.153,.01,.01,.008);
 }
 return {group,figure,arms,legs,phase:0,amount:0};
}
export function animateAvatar(a,now,dt,moving){a.amount=THREE.MathUtils.lerp(a.amount,moving?1:0,Math.min(1,dt*10));a.phase+=dt*8;const swing=Math.sin(a.phase)*a.amount;a.legs[0].rotation.x=swing*.5;a.legs[1].rotation.x=-swing*.5;a.arms[0].rotation.x=-swing*.38;a.arms[1].rotation.x=swing*.38;a.figure.position.y=Math.abs(Math.sin(a.phase))*a.amount*.025;const cape=a.figure.getObjectByName('cape');if(cape)cape.rotation.x=-a.amount*(.05+Math.sin(a.phase)*.03)}
