import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// The supplied model is a rigged Mixamo character in centimetres that faces +Z.
// Its bundled clip only holds a static pose, so the walk cycle here is built from
// bone rotations. Rotating bones cannot stretch the skin, unlike scaling a group.
const MODEL='/models/michael.glb', HEIGHT_METERS=2.32;
const X_AXIS=new THREE.Vector3(1,0,0), Z_AXIS=new THREE.Vector3(0,0,1);
const q=new THREE.Quaternion();

export function createMonster(){
 const group=new THREE.Group(),holder=new THREE.Group();
 holder.rotation.y=Math.PI; // game forward is -Z, the model faces +Z
 group.add(holder);
 const rig={group,holder,ready:false,phase:0,bones:{},mixer:null,machete:null};
 addMachetePlaceholder(false); // only revealed if the model cannot load
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 loader.load(MODEL,gltf=>{
  const model=gltf.scene;
  model.traverse(o=>{
   if(o.isMesh){o.frustumCulled=false;o.castShadow=false;if(o.material){o.material.metalness=Math.min(o.material.metalness??0,.4);o.material.roughness=Math.max(o.material.roughness??.8,.55)}}
   if(o.isBone)rig.bones[o.name]=o;
  });
  const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y;
  model.scale.setScalar(HEIGHT_METERS/(height||2.13));
  holder.add(model);
  if(!gltf.animations.length)return;
  rig.mixer=new THREE.AnimationMixer(model);
  rig.mixer.clipAction(gltf.animations[0]).play();
  rig.mixer.update(0);
  const parts=['Hips','Spine2','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftArm','RightArm','LeftForeArm','RightForeArm','RightHand','LeftHand','Neck','Head'];
  rig.parts={};
  for(const part of parts){const re=new RegExp(part+'(_\\d+)?$'),name=Object.keys(rig.bones).find(n=>re.test(n));rig.parts[part]=name?rig.bones[name]:null}
  attachMachete(rig);
  rig.ready=true;
  addMachetePlaceholder(false);
 },undefined,error=>{console.warn('Michael Myers model unavailable',error);addMachetePlaceholder(true)});
 return rig;

 function addMachetePlaceholder(on=true){ // a dark silhouette if the model cannot load
  if(rig.fallback){rig.fallback.visible=on;return}
  const material=new THREE.MeshStandardMaterial({color:0x191b19,roughness:.9});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.26,.62,6,12),material);
  body.position.y=1.2;const head=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshStandardMaterial({color:0xd9d3c4,roughness:.8}));
  head.position.y=1.92;const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.6,6,10),material);
  leg.position.set(-.15,.45,0);const leg2=leg.clone();leg2.position.x=.15;
  rig.fallback=new THREE.Group();rig.fallback.add(body,head,leg,leg2);rig.fallback.visible=on;group.add(rig.fallback);
 }

 function attachMachete(rig){
  const hand=rig.parts.RightHand;if(!hand)return;
  const steel=new THREE.MeshStandardMaterial({color:0xa8b0ad,metalness:.85,roughness:.3});
  const grip=new THREE.MeshStandardMaterial({color:0x2a2019,roughness:.85});
  const weapon=new THREE.Group();
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.6,11,10),grip);handle.position.y=4.5;
  const blade=new THREE.Mesh(new THREE.BoxGeometry(5.2,31,.5),steel);blade.position.y=24;
  const tip=new THREE.Mesh(new THREE.ConeGeometry(3.6,7,4),steel);tip.rotation.y=Math.PI/4;tip.scale.z=.18;tip.position.y=43;
  const guard=new THREE.Mesh(new THREE.BoxGeometry(7,1.4,1.8),grip);guard.position.y=10.2;
  weapon.add(handle,blade,tip,guard);
  weapon.position.set(0,5,1.2);weapon.rotation.set(-.35,0,.12); // along the hand, angled a little forward
  hand.add(weapon);rig.machete=weapon;
 }
}

export function animateMonster(m,dt,moving,chasing=false,sleeping=false){
 if(m.fallback&&!m.ready){m.fallback.rotation.z=Math.sin((m.phase+=dt*2))*.02;return}
 if(!m.ready)return;
 m.phase+=dt*(moving?(chasing?8.4:5.4):1.1);
 const stride=moving?(chasing?.62:.44):0, swing=Math.sin(m.phase), lift=Math.abs(Math.cos(m.phase));
 if(m.mixer)m.mixer.update(dt);
 m.holder.rotation.z+=((sleeping?1.45:0)-m.holder.rotation.z)*Math.min(1,dt*4);
 m.holder.rotation.x+=((sleeping?-.1:0)-m.holder.rotation.x)*Math.min(1,dt*4);
 if(sleeping){m.holder.position.y=0;return}
 const p=m.parts||{};
 turn(p.LeftUpLeg,X_AXIS,-swing*stride);
 turn(p.RightUpLeg,X_AXIS,swing*stride);
 turn(p.LeftLeg,X_AXIS,-Math.max(0,Math.sin(m.phase+.75))*stride*1.35);
 turn(p.RightLeg,X_AXIS,-Math.max(0,Math.sin(m.phase+.75+Math.PI))*stride*1.35);
 // The right arm carries the machete, so it only drifts instead of swinging freely.
 turn(p.LeftArm,Z_AXIS,swing*stride*.55);
 turn(p.RightArm,Z_AXIS,-swing*stride*.22);
 turn(p.LeftForeArm,Z_AXIS,.12+Math.max(0,swing)*.2);
 turn(p.RightForeArm,X_AXIS,-.28);
 turn(p.Spine2,X_AXIS,moving?-.05-Math.abs(swing)*.02:-.02);
 turn(p.Hips,X_AXIS,moving?.03:0);
 if(p.Neck)turn(p.Neck,Z_AXIS,Math.sin(m.phase*.5)*.045);
 m.holder.position.y=moving?lift*.035:0;
 function turn(bone,axis,angle){
  if(!bone)return;
  q.setFromAxisAngle(axis,angle);
  bone.quaternion.premultiply(q);
 }
}
