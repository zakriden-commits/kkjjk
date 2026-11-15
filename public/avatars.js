import * as THREE from 'three';

// Low-poly characters keep the multiplayer room friendly to mobile GPUs.
const materials = new Map();
function material(color, roughness = .8) {
  const key = `${color}-${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key);
}
function shape(parent, geometry, color, x, y, z, rx=0, ry=0, rz=0) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x,y,z); mesh.rotation.set(rx,ry,rz); parent.add(mesh); return mesh;
}
function box(parent,w,h,d,color,x,y,z,rz=0) { return shape(parent,new THREE.BoxGeometry(w,h,d),color,x,y,z,0,0,rz); }
function sphere(parent,r,color,x,y,z,sx=1,sy=1,sz=1) { const m=shape(parent,new THREE.SphereGeometry(r,12,8),color,x,y,z);m.scale.set(sx,sy,sz);return m; }
function limb(parent, x, y, color, glove, leg=false) {
  const pivot=new THREE.Group();pivot.position.set(x,y,0);parent.add(pivot);
  box(pivot,leg?.19:.17,leg?.55:.48,leg?.21:.18,color,0,leg?-.26:-.22,0);
  if(leg)box(pivot,.21,.13,.32,glove,0,-.56,-.055);
  else sphere(pivot,.1,glove,0,-.48,0,1,1.1,1);
  return pivot;
}
export function createAvatar(skin) {
  const bat=skin==='batman', root=new THREE.Group(), figure=new THREE.Group();root.add(figure);
  const suit=bat?0x39404b:0x66378d, dark=bat?0x141b27:0x42215f, skinColor=bat?0xc99b79:0xf1eee3;
  const legs=[limb(figure,-.13,.64,dark,bat?0x10151d:0x302136,true),limb(figure,.13,.64,dark,bat?0x10151d:0x302136,true)];
  box(figure,.49,.57,.26,suit,0,1.01,0);box(figure,.47,.12,.28,dark,0,.72,0);
  const arms=[limb(figure,-.34,1.24,suit,bat?0x131923:0xe8e0cf),limb(figure,.34,1.24,suit,bat?0x131923:0xe8e0cf)];
  sphere(figure,.225,skinColor,0,1.61,0,1,1.12,.91);
  if(bat){
    // Cowl, pointed ears, pale eyes, gold belt and a flowing dark cape.
    sphere(figure,.23,0x171e29,0,1.69,.012,1,1,.93);
    box(figure,.31,.115,.07,skinColor,0,1.52,-.195);
    for(const x of [-.115,.115]){const ear=shape(figure,new THREE.ConeGeometry(.065,.23,4),0x171e29,x,1.94,.01);ear.rotation.z=x<0?.12:-.12;box(figure,.09,.025,.02,0xe9ecdf,x,1.69,-.214,x<0?-.18:.18)}
    box(figure,.5,.10,.29,0xc9a640,0,.74,0);box(figure,.09,.11,.31,0xe4c25a,0,.74,0);
    const emblem=shape(figure,new THREE.SphereGeometry(.12,12,8),0xc7a83d,0,1.15,-.145);emblem.scale.set(1.45,.6,.12);
    box(figure,.18,.045,.015,0x1b2029,0,1.15,-.164);for(const x of [-.105,.105])box(figure,.09,.035,.015,0x1b2029,x,1.16,-.165,x<0?-.35:.35);
    const cape=shape(figure,new THREE.BoxGeometry(.53,1.06,.055),0x171e29,0,.92,.19,-.12);cape.name='cape';
  }else{
    // Green swept hair, painted grin, tailored purple jacket and waistcoat.
    sphere(figure,.23,0x30924d,0,1.77,.015,1,.55,.95);
    for(const x of [-.15,-.05,.05,.15]){const tuft=shape(figure,new THREE.ConeGeometry(.075,.18,5),0x399d50,x,1.91,.02);tuft.rotation.z=-.25}
    for(const x of [-.09,.09]){box(figure,.045,.035,.02,0x34313e,x,1.65,-.201);box(figure,.065,.018,.02,0x3f3550,x,1.71,-.194,x<0?-.2:.2)}
    box(figure,.19,.035,.025,0xbb3547,0,1.53,-.204);for(const x of [-.1,.1])box(figure,.035,.03,.025,0xbb3547,x,1.55,-.197,x<0?-.5:.5);
    box(figure,.19,.48,.035,0x6a9a41,0,1.04,-.145);box(figure,.11,.18,.04,0xede2c8,0,1.22,-.17);box(figure,.055,.16,.05,0x56307a,0,1.18,-.2);
    for(const x of [-.16,.16])box(figure,.09,.42,.04,0x8a53ab,x,1.07,-.15,x<0?-.23:.23);
    for(const y of [.9,1.01,1.12])sphere(figure,.015,0xdabf77,.04,y,-.18);
    box(figure,.1,.04,.025,0xe1ad4d,.17,1.19,-.18);
  }
  return {group:root,figure,arms,legs,phase:0,amount:0};
}
export function animateAvatar(a, now, dt, moving) {
  a.amount=THREE.MathUtils.lerp(a.amount,moving?1:0,Math.min(1,dt*10));
  a.phase+=dt*9;
  const swing=Math.sin(a.phase)*a.amount;
  a.legs[0].rotation.x=swing*.6;a.legs[1].rotation.x=-swing*.6;
  a.arms[0].rotation.x=-swing*.48;a.arms[1].rotation.x=swing*.48;
  a.figure.position.y=Math.abs(Math.sin(a.phase))*a.amount*.035;
  const cape=a.figure.getObjectByName('cape');if(cape)cape.rotation.x=-.12-a.amount*(.12+Math.sin(a.phase)*.05);
}
