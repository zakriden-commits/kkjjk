import * as THREE from 'three';
import { createCharacter, animateCharacter } from './characters.js';
export function createLift(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b211f);const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.05,20);camera.position.set(0,1.65,1.05);
 scene.add(new THREE.HemisphereLight(0xe6e2c5,0x303b39,1.6));const lamp=new THREE.PointLight(0xf5e8ba,14,8);lamp.position.set(0,2.65,0);scene.add(lamp);
 function box(w,h,d,x,y,z,c){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:.62,metalness:.35}));mesh.position.set(x,y,z);scene.add(mesh);return mesh}
 box(3,.1,3,0,-.05,0,0x383e3a);box(3,.1,3,0,3,0,0x444d48);box(.1,3,3,-1.55,1.5,0,0x4b5751);box(.1,3,3,1.55,1.5,0,0x4b5751);box(3,3,.1,0,1.5,1.5,0x404a45);
 box(3,.15,.1,0,2.85,-1.5,0x262e2c);box(.5,2.7,.1,-1.25,1.35,-1.5,0x343c38);box(.5,2.7,.1,1.25,1.35,-1.5,0x343c38);box(1,.08,.3,0,2.93,0,0xffefbd);
 for(const x of [-1.48,1.48]){box(.04,.05,2.6,x,1,0,0x9b9d8e)}
 const left=box(1,2.7,.1,-.5,1.35,-1.5,0x7c847c),right=box(1,2.7,.1,.5,1.35,-1.5,0x7c847c);
 box(3,3,.1,0,1.5,-3,0xb3a25c);box(3,.1,2,0,0,-2.4,0x9b8e5e);let companion=null;
 function start(together,skin){left.position.x=-.5;right.position.x=.5;if(companion)scene.remove(companion.group);companion=together?createCharacter(skin):null;if(companion){companion.group.position.set(.65,0,-.35);scene.add(companion.group)}}
 function update(elapsed,dt){camera.position.y=1.65+(elapsed<3.2?Math.sin(elapsed*11)*.007:0);const open=THREE.MathUtils.smoothstep(elapsed,3.2,5.2);left.position.x=-.5-open;right.position.x=.5+open;if(companion)animateCharacter(companion,dt,false,false,false)}
 return {scene,camera,start,update};
}
