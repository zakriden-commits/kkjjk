import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

// Deadpool ships with a real rig, Batman is a static sculpt. For the static mesh we
// build a humanoid skeleton and paint skin weights from distances to bone segments,
// so both skins animate from bones and never by scaling the mesh.
const MODELS={deadpool:'/models/deadpool.glb',batman:'/models/batman.glb'};
const HEIGHT={deadpool:1.86,batman:1.9};
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache=new Map();
const X_AXIS=new THREE.Vector3(1,0,0),Z_AXIS=new THREE.Vector3(0,0,1);
const tmpQ=new THREE.Quaternion(),tmpV=new THREE.Vector3();

function loadModel(skin){
 if(!cache.has(skin))cache.set(skin,new Promise(resolve=>{
  loader.load(MODELS[skin]||MODELS.deadpool,gltf=>resolve(gltf),undefined,error=>{console.warn('skin failed',skin,error);resolve(null)});
 }));
 return cache.get(skin)
}
export function preloadCharacters(){for(const skin of Object.keys(MODELS))loadModel(skin)}

export function createCharacter(skin){
 const group=new THREE.Group(),holder=new THREE.Group();
 holder.rotation.y=Math.PI; // models face +Z, the game walks toward -Z
 group.add(holder);
 const ch={group,holder,skin,ready:false,phase:0,fallback:null,bones:{},base:new Map(),jump:0};
 placeholder(ch);
 loadModel(skin).then(gltf=>{
  if(!gltf){if(ch.fallback)ch.fallback.visible=true;return}
  const model=skeletonClone(gltf.scene);
  const box=new THREE.Box3().setFromObject(model),height=Math.max(.1,box.max.y-box.min.y);
  const scale=(HEIGHT[skin]||1.85)/height;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const scaled=new THREE.Box3().setFromObject(model);
  model.position.y-=scaled.min.y;
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(Array.isArray(o.material))o.material.forEach(m=>m.side=THREE.FrontSide);else if(o.material)o.material.side=THREE.FrontSide}});
  let rigged=model,generatedBones=null;
  if(!hasSkeleton(model)){const result=autoRig(model);rigged=result.object;generatedBones=result.bones;ch.modelRigged=true}
  holder.add(rigged);
  ch.model=rigged;
  if(generatedBones)Object.assign(ch.bones,generatedBones);
  collectBones(ch);
  ch.ready=true;
  if(ch.fallback)ch.fallback.visible=false;
  relaxArms(ch);
 });
 return ch
}

function hasSkeleton(root){let found=false;root.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton&&o.skeleton.bones.length>6)found=true});return found}

function placeholder(ch){
 const material=new THREE.MeshStandardMaterial({color:0x2a2a30,roughness:.85});
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.55,6,12),material);body.position.y=1.05;
 const head=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),material);head.position.y=1.62;
 ch.fallback=new THREE.Group();ch.fallback.add(body,head);ch.fallback.visible=false;ch.group.add(ch.fallback);
}

// --- static mesh rigging -------------------------------------------------------
function autoRig(model){
 model.updateMatrixWorld(true);
 const mesh=findMesh(model);
 if(!mesh||!mesh.geometry)return {object:model,bones:null};
 // Bones live in the mesh's own local space, so the sculpt keeps its transform.
 const geometry=mesh.geometry.clone();
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,size=new THREE.Vector3();box.getSize(size);
 const H=size.y||2.5,baseY=box.min.y;
 const position=geometry.attributes.position,count=position.count;
 const handTips=findHandTips(position,box,H,baseY);
 const spec={
  hips:[0,baseY+H*.5,0],spine:[0,baseY+H*.61,0],chest:[0,baseY+H*.74,0],neck:[0,baseY+H*.85,0],head:[0,baseY+H*.92,0],
  lThigh:[H*.075,baseY+H*.5,0],rThigh:[-H*.075,baseY+H*.5,0],
  lShin:[H*.08,baseY+H*.27,0],rShin:[-H*.08,baseY+H*.27,0],
  lFoot:[H*.08,baseY+H*.04,H*.015],rFoot:[-H*.08,baseY+H*.04,H*.015],
  lShoulder:[H*.11,baseY+H*.78,0],rShoulder:[-H*.11,baseY+H*.78,0],
  lUpperArm:[H*.18,baseY+H*.76,0],rUpperArm:[-H*.18,baseY+H*.76,0],
  lForeArm:[(H*.18+handTips.l.x)/2,(baseY+H*.76+handTips.l.y)/2,0],rForeArm:[(-H*.18+handTips.r.x)/2,(baseY+H*.76+handTips.r.y)/2,0],
  lHand:[handTips.l.x,handTips.l.y,handTips.l.z],rHand:[handTips.r.x,handTips.r.y,handTips.r.z]
 };
 const parentOf={spine:'hips',chest:'spine',neck:'chest',head:'neck',lThigh:'hips',rThigh:'hips',lShin:'lThigh',rShin:'rThigh',lFoot:'lShin',rFoot:'rShin',lShoulder:'chest',rShoulder:'chest',lUpperArm:'lShoulder',rUpperArm:'rShoulder',lForeArm:'lUpperArm',rForeArm:'rUpperArm',lHand:'lForeArm',rHand:'rForeArm'};
 const bones={},order=['hips','spine','chest','neck','head','lThigh','rThigh','lShin','rShin','lFoot','rFoot','lShoulder','rShoulder','lUpperArm','rUpperArm','lForeArm','rForeArm','lHand','rHand'];
 for(const name of order){
  const bone=new THREE.Bone();bone.name='rig_'+name;
  const world=spec[name],parent=parentOf[name];
  if(parent&&bones[parent]){bones[parent].add(bone);bone.position.set(world[0]-spec[parent][0],world[1]-spec[parent][1],world[2]-spec[parent][2])}
  else bone.position.set(world[0],world[1],world[2]);
  bones[name]=bone;
 }
 const segments=order.map(name=>({name,a:new THREE.Vector3(...spec[name]),b:parentOf[name]?new THREE.Vector3(...spec[parentOf[name]]):new THREE.Vector3(...spec[name])}));
 const skinIndex=new Uint16Array(count*4),skinWeight=new Float32Array(count*4);
 const point=new THREE.Vector3(),closest=new THREE.Vector3(),ab=new THREE.Vector3();
 for(let i=0;i<count;i++){
  point.fromBufferAttribute(position,i);
  const scored=segments.map(segment=>{
   ab.copy(segment.a).sub(segment.b);
   const t=THREE.MathUtils.clamp(point.clone().sub(segment.b).dot(ab)/Math.max(1e-6,ab.lengthSq()),0,1);
   closest.copy(segment.b).addScaledVector(ab,t);
   return {index:order.indexOf(segment.name),distance:point.distanceTo(closest)+1e-3};
  }).sort((a,b)=>a.distance-b.distance).slice(0,3);
  const total=scored.reduce((sum,s)=>sum+1/Math.pow(s.distance,3),0);
  for(let k=0;k<4;k++){
   const s=scored[k];
   skinIndex[i*4+k]=s?s.index:0;
   skinWeight[i*4+k]=s?(1/Math.pow(s.distance,3))/total:0;
  }
 }
 geometry.setAttribute('skinIndex',new THREE.BufferAttribute(skinIndex,4));
 geometry.setAttribute('skinWeight',new THREE.BufferAttribute(skinWeight,4));
 const skinned=new THREE.SkinnedMesh(geometry,mesh.material);
 skinned.name='auto-rigged';
 skinned.position.copy(mesh.position);skinned.quaternion.copy(mesh.quaternion);skinned.scale.copy(mesh.scale);
 skinned.add(bones.hips);
 const holder=mesh.parent||model;
 holder.add(skinned);holder.remove(mesh);
 skinned.updateMatrixWorld(true);
 skinned.bind(new THREE.Skeleton(order.map(name=>bones[name])));
 skinned.userData.rig=bones;
 return {object:model,bones}
}
function findMesh(root){let found=null;root.traverse(o=>{if(!found&&o.isMesh&&o.geometry)found=o});return found}
function findHandTips(position,box,H,baseY){
 let lx=-Infinity,rx=Infinity,ly=0,ry=0,lz=0,rz=0;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i);
  if(y<baseY+H*.45||y>baseY+H*.95)continue;
  if(x>lx){lx=x;ly=y;lz=position.getZ(i)}
  if(x<rx){rx=x;ry=y;rz=position.getZ(i)}
 }
 return {l:{x:lx,y:ly,z:lz},r:{x:rx,y:ry,z:rz}}
}

// --- shared animation ----------------------------------------------------------
function collectBones(ch){
 const map={
  hips:/hips|pelvis|spine_01|sp_1/i,spine:/spine|sp_2|sp_3/i,chest:/chest|spine2|sp_4|torso/i,
  neck:/neck|nk_1/i,head:/head|nk_2/i,
  lThigh:/(leftupleg|ll_1|leftthigh|thigh_l|l_upleg)/i,rThigh:/(rightup Leg|rl_1|rightthigh|thigh_r|r_upleg)/i,
  lShin:/(leftleg_|ll_2|leftshin|shin_l|leftleg$)/i,rShin:/(rightleg|rl_2|rightshin|shin_r)/i,
  lFoot:/(leftfoot|ll_3|lefttoe|ll_4)/i,rFoot:/(rightfoot|rl_3|righttoe|rl_4)/i,
  lUpperArm:/(leftarm|leftshoulder|lh_1)/i,rUpperArm:/(rightarm|rightshoulder|rh_1)/i,
  lForeArm:/(leftforearm|lh_2)/i,rForeArm:/(rightforearm|rh_2)/i,
  lHand:/(lefthand|lh_3)/i,rHand:/(righthand|rh_3)/i
 };
 const all=[];
 ch.model.traverse(o=>{if(o.isBone)all.push(o)});
 for(const [key,pattern] of Object.entries(map)){
  const bone=all.find(b=>pattern.test(b.name));
  if(bone)ch.bones[key]=bone;
 }
 for(const bone of Object.values(ch.bones))ch.base.set(bone,bone.quaternion.clone());
}

function rotateAboutWorldBone(ch,bone,axis,angle){
 if(!bone||!angle)return;
 const parent=bone.parent;
 const worldQuat=parent.getWorldQuaternion(tmpQ).invert();
 const axisLocal=axis.clone().applyQuaternion(worldQuat).normalize();
 const q=new THREE.Quaternion().setFromAxisAngle(axisLocal,angle);
 bone.quaternion.premultiply(q);
}

function relaxArms(ch){
 // A T pose reads as levitating. Rotate each upper arm down and keep the result as its base pose.
 if(!ch.ready)return;
 ch.group.updateMatrixWorld(true);
 for(const side of ['l','r']){
  const upper=ch.bones[side==='l'?'lUpperArm':'rUpperArm'],hand=ch.bones[side==='l'?'lHand':'rHand'];
  if(!upper||!hand)continue;
  const start=hand.getWorldPosition(new THREE.Vector3()).y;
  let best={axis:Z_AXIS,angle:0,y:start};
  for(const axis of [Z_AXIS,X_AXIS]){
   for(const angle of [.9,-.9,1.35,-1.35]){
    const saved=upper.quaternion.clone();
    upper.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));
    ch.group.updateMatrixWorld(true);
    const y=hand.getWorldPosition(new THREE.Vector3()).y;
    upper.quaternion.copy(saved);ch.group.updateMatrixWorld(true);
    if(y<best.y-.01)best={axis,angle,y};
   }
  }
  if(best.angle){
   upper.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(best.axis,best.angle));
   ch.base.set(upper,upper.quaternion.clone());
   ch.group.updateMatrixWorld(true);
  }
 }
}

export function animateCharacter(ch,dt,moving=false,running=false,jumping=false){
 if(!ch.ready){if(ch.fallback)ch.fallback.rotation.z=Math.sin(performance.now()*.002)*.02;return}
 ch.phase+=dt*(moving?(running?9.5:6):1.4);
 const stride=moving?(running?.72:.48):0,swing=Math.sin(ch.phase),lift=Math.abs(Math.cos(ch.phase));
 for(const [bone,quat] of ch.base)bone.quaternion.copy(quat);
 const b=ch.bones;
 rotateAboutWorldBone(ch,b.lThigh,X_AXIS,-swing*stride);
 rotateAboutWorldBone(ch,b.rThigh,X_AXIS,swing*stride);
 rotateAboutWorldBone(ch,b.lShin,X_AXIS,Math.max(0,-Math.sin(ch.phase+.6))*stride*1.5);
 rotateAboutWorldBone(ch,b.rShin,X_AXIS,Math.max(0,-Math.sin(ch.phase+.6+Math.PI))*stride*1.5);
 rotateAboutWorldBone(ch,b.lUpperArm,X_AXIS,swing*stride*.75);
 rotateAboutWorldBone(ch,b.rUpperArm,X_AXIS,-swing*stride*.75);
 rotateAboutWorldBone(ch,b.lForeArm,X_AXIS,-.25-Math.max(0,swing)*.25);
 rotateAboutWorldBone(ch,b.rForeArm,X_AXIS,-.25-Math.max(0,-swing)*.25);
 rotateAboutWorldBone(ch,b.spine,X_AXIS,moving?(running?.16:.08):0);
 if(jumping){
  rotateAboutWorldBone(ch,b.lThigh,X_AXIS,-.7);
  rotateAboutWorldBone(ch,b.rThigh,X_AXIS,-.5);
  rotateAboutWorldBone(ch,b.lShin,X_AXIS,-.9);
  rotateAboutWorldBone(ch,b.rShin,X_AXIS,-.8);
  rotateAboutWorldBone(ch,b.lUpperArm,X_AXIS,-.7);
  rotateAboutWorldBone(ch,b.rUpperArm,X_AXIS,-.7);
 }
 ch.holder.position.y=moving?lift*.02:0;
}
