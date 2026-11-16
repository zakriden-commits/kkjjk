import { createMonster, animateMonster } from './monster.js';
import { makeTool, makeWeapon } from './tools.js';
import { createVoice } from './voice.js';
import { createLift } from './lift.js';
import { createMaze, placeSpots, updateMaze, canWalk, isSafe, limitFor } from './maze.js';
import { createCharacter, animateCharacter, preloadCharacters } from './characters.js';
import * as THREE from 'three';

const WEAPONS=['akA','akB'],WEAPON_LABEL={akA:'Красный АК-47',akB:'Синий АК-47'},MAG=30;
const $=selector=>document.querySelector(selector);

// ---------------------------------------------------------------- renderer
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x120d0c);
scene.fog=new THREE.Fog(0x120d0c,10,30);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,95);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
$('#game').append(renderer.domElement);
const ambient=new THREE.HemisphereLight(0xff8a5c,0x140707,1.4);
scene.add(ambient);
const light=new THREE.DirectionalLight(0xff9a6a,1.1);
light.position.set(3,9,5);
scene.add(light);

// ---------------------------------------------------------------- rooms
const mainRoom=new THREE.Group(),basement=new THREE.Group(),voidRoom=new THREE.Group();
scene.add(mainRoom,basement,voidRoom);
voidRoom.visible=false;
const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.95});
function box(group,w,h,d,x,y,z,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));mesh.position.set(x,y,z);group.add(mesh);return mesh}
box(mainRoom,18,.2,18,0,-.1,0,0x1d1512);box(mainRoom,18,.2,18,0,5.6,0,0x241a15);
box(mainRoom,18,5.6,.2,0,2.7,-9,0x2a1d17);box(mainRoom,18,5.6,.2,0,2.7,9,0x2a1d17);
box(mainRoom,.2,5.6,18,-9,2.7,0,0x281b16);box(mainRoom,.2,5.6,18,9,2.7,0,0x281b16);
for(const x of [-5.6,5.6])box(mainRoom,.5,5.6,.5,x,2.7,-9,0x1b1310);
// Glowing pit that leads downstairs.
box(mainRoom,3.1,.1,3.1,4.5,-1.4,-6.5,0x090504);
const pitLight=new THREE.PointLight(0xff3d12,16,10);
pitLight.position.set(4.5,.4,-6.5);mainRoom.add(pitLight);
box(mainRoom,3.3,.14,.16,4.5,.06,-4.95,0x7d2a14);box(mainRoom,.16,.14,3.3,2.87,.06,-6.5,0x7d2a14);
box(mainRoom,.16,.14,3.3,6.13,.06,-6.5,0x7d2a14);box(mainRoom,3.3,.14,.16,4.5,.06,-8.05,0x7d2a14);
const mainLight=new THREE.PointLight(0xff5426,10,20);mainLight.position.set(0,4,3);mainRoom.add(mainLight);

const voidWall=new THREE.MeshStandardMaterial({color:0x0a0706,roughness:1});
voidRoom.add(new THREE.Mesh(new THREE.BoxGeometry(40,.2,40),voidWall)).position.y=-.1;
const voidLight=new THREE.PointLight(0xff4a1f,4,16);voidLight.position.set(0,2.4,3);voidRoom.add(voidLight);

// ---------------------------------------------------------------- monsters, lift, held items
const monster=createMonster();basement.add(monster.group);monster.group.visible=false;
const monsterTarget=new THREE.Vector3();
let monsterUpdated=0,monsterRotation=0,monsterChasing=false,monsterSleeping=false;
const lift3d=createLift();
const held=new THREE.Group();camera.add(held);held.position.set(.3,-.44,-.62);held.scale.setScalar(1.15);
let heldWeapon=null;
const muzzle=new THREE.PointLight(0xffb066,0,6);muzzle.position.set(0,.05,-.9);camera.add(muzzle);
// A handheld beam keeps the maze readable without turning it bright.
const torch=new THREE.SpotLight(0xffd3ae,0,26,Math.PI/4.2,.55,1.1);
torch.position.set(0,0,0);torch.target.position.set(0,-.08,-1);
camera.add(torch);camera.add(torch.target);
const torchFill=new THREE.PointLight(0xff9a6a,0,7);camera.add(torchFill);

// ---------------------------------------------------------------- state
let socket=null,playing=false,selfId=0,selfSlot=0,ownWeapon='akA';
let mazeSeed=0,coopMode=false,room='main',sessionId=null,n=13,maze=null,spots=[],puzzle={crowbar:false,hammer:false,akA:false,akB:false,nails:false,boards:false,door:false};
let equipped=null,ammo=MAG,reloadUntil=0,shooting=false,lastShot=0;
let stamina=100,sprinting=false,exhausted=false,toolUseUntil=0,inTransition=false,portalReady=0;
let vertical=0,jumpVelocity=0,activeTarget=null,lastLiftStart=0;
let selfDown=false,downUntil=0,overShown=false,rescueHolding=false;
const downedOthers=new Map();
let yaw=0,pitch=0,pos=new THREE.Vector3(4.5,1.65,0),keys={},move={x:0,y:0};
const others=new Map();
const audio={context:null};
const voice=createVoice(send,notify,payload=>{try{if(socket?.readyState===WebSocket.OPEN)socket.send(payload)}catch{}});

// ---------------------------------------------------------------- audio
function unlockAudio(){try{const C=window.AudioContext||window.webkitAudioContext;if(C){audio.context=audio.context||new C();audio.context.resume()}}catch{}}
let stepNoise=null,stepPan=1;
function footstep(running=false,volume=1){try{const ctx=audio.context;if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime;
 if(!stepNoise){stepNoise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.4),ctx.sampleRate);const data=stepNoise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3)}
 const src=ctx.createBufferSource();src.buffer=stepNoise;src.playbackRate.value=(running?.84:.94)+Math.random()*.18;
 const band=ctx.createBiquadFilter();band.type='bandpass';band.frequency.value=(running?760:1020)+Math.random()*240;band.Q.value=1.1;
 const gain=ctx.createGain();gain.gain.setValueAtTime((running?.22:.12)*volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+(running?.22:.16));
 const thump=ctx.createOscillator(),thumpGain=ctx.createGain();thump.type='sine';thump.frequency.setValueAtTime(running?96:124,t);thump.frequency.exponentialRampToValueAtTime(46,t+.11);
 thumpGain.gain.setValueAtTime((running?.13:.07)*volume,t);thumpGain.gain.exponentialRampToValueAtTime(.0001,t+.14);
 const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;if(pan){pan.pan.value=stepPan*.16;stepPan*=-1}
 src.connect(band).connect(gain);if(pan){gain.connect(pan);thumpGain.connect(pan);pan.connect(ctx.destination)}else{gain.connect(ctx.destination);thumpGain.connect(ctx.destination)}
 src.start(t);src.stop(t+.4);thump.start(t);thump.stop(t+.16)}catch{}}
function tone(frequency,duration,type='square',volume=.06,slideTo){try{const ctx=audio.context;if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=type;osc.frequency.setValueAtTime(frequency,t);if(slideTo)osc.frequency.exponentialRampToValueAtTime(slideTo,t+duration);
 gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+duration+.02)}catch{}}
function gunshot(distance=0){try{const ctx=audio.context;if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime;
 const noise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.22),ctx.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,4);
 const src=ctx.createBufferSource();src.buffer=noise;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2400;
 const gain=ctx.createGain();gain.gain.setValueAtTime(.42*Math.max(.15,1-distance/30),t);gain.gain.exponentialRampToValueAtTime(.0001,t+.22);
 src.connect(filter).connect(gain).connect(ctx.destination);src.start(t);
 tone(90,.16,'sawtooth',.16*(1-distance/40||1),40)}catch{}}
function reloadSound(){tone(320,.06,'square',.05);setTimeout(()=>tone(220,.07,'square',.05),220);setTimeout(()=>tone(440,.06,'square',.06),480)}
function soundLift(){tone(66,3,'triangle',.05,48);setTimeout(()=>{tone(880,.5,'sine',.05);setTimeout(()=>tone(1108,.5,'sine',.05),240)},3300)}
const monsterMusic=new Audio('/audio/myers.mp3');monsterMusic.loop=true;monsterMusic.preload='auto';monsterMusic.volume=0;
const killAudio=new Audio('/audio/kill.mp3');killAudio.preload='auto';
let musicFailed=false,lastHeart=0;
monsterMusic.addEventListener('error',()=>{musicFailed=true});
killAudio.addEventListener('error',()=>{killAudio.dataset.missing='1'});
let musicMuteUntil=0;
function playKill(){
 musicMuteUntil=performance.now()+1500;
 if(killAudio.dataset.missing)return playSound('caught');
 try{killAudio.currentTime=0;killAudio.play().catch(()=>playSound('caught'))}catch{playSound('caught')}
}
function unlockAudio_(){try{monsterMusic.muted=true;monsterMusic.play().then(()=>{monsterMusic.pause();monsterMusic.muted=false}).catch(()=>{monsterMusic.muted=false})}catch{}}
function playSound(kind){if(kind==='door')tone(120,.3,'square',.07,60);else if(kind==='caught')tone(58,.5,'sawtooth',.09,36);else if(kind==='tool')tone(300,.12,'square',.06,180);else if(kind==='sleep')tone(70,.9,'sine',.09,34)}

// ---------------------------------------------------------------- UI helpers
const action=$('#action'),modal=$('#modal'),settings=$('#settings');
function notify(text){const node=$('#place-notice');node.textContent=text;node.hidden=false;if(!playing){const status=$('#status');if(status)status.textContent=text}
 clearTimeout(notify.timer);notify.timer=setTimeout(()=>{node.hidden=true},4200)}
function showDialog(title,text,buttons){$('#modal-title').textContent=title;$('#modal-text').textContent=text;const container=$('#modal-buttons');container.replaceChildren();
 for(const [caption,fn] of buttons){const button=document.createElement('button');button.textContent=caption;button.onclick=fn;container.append(button)}modal.hidden=false}
function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
const deadScreen=$('#dead'),deadText=$('#dead-text'),bannerBox=$('#banner'),overScreen=$('#over'),overText=$('#over-text'),
 rescueButton=$('#rescue'),rescueBar=$('#rescue-bar'),rescueFill=rescueBar.querySelector('i');
function showBanner(text,ms=6000){bannerBox.textContent=text;bannerBox.hidden=false;clearTimeout(showBanner.timer);showBanner.timer=setTimeout(()=>bannerBox.hidden=true,ms)}
function clockText(ms){const total=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`}
$('#over-btn').onclick=()=>location.reload();
document.querySelectorAll('.settings-open').forEach(button=>button.onclick=()=>settings.hidden=false);
$('#settings-close').onclick=()=>settings.hidden=true;
$('#history-btn').onclick=async()=>{let text='Пока никто не заходил.';try{const data=await (await fetch('/api/history')).json();
 if(data.lastVisit){const when=new Date(data.lastVisit.time).toLocaleString('ru-RU');text=`Последнее устройство: ${data.lastVisit.device}. Время входа: ${when}.`}}catch{}
 showDialog('История устройств',text,[['Закрыть',()=>modal.hidden=true]])};
fetch('/api/version').then(r=>r.json()).then(d=>$('#build-info').textContent='сборка '+d.build).catch(()=>$('#build-info').textContent='сборка неизвестна');

// ---------------------------------------------------------------- lobby backdrop
const lobbyScene=new THREE.Scene();
lobbyScene.background=new THREE.Color(0x160a08);
lobbyScene.fog=new THREE.Fog(0x160a08,7,26);
const lobbyCamera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.1,60);
lobbyCamera.position.set(0,1.7,8);
const lobbyMonster=createMonster();
lobbyMonster.group.position.set(0,0,-2);
lobbyScene.add(lobbyMonster.group);
for(const side of [-1,1]){const wall=new THREE.Mesh(new THREE.BoxGeometry(.4,4,34),new THREE.MeshStandardMaterial({color:0x2b1a14,roughness:1}));wall.position.set(side*2.6,2,-4);lobbyScene.add(wall);
 for(let z=-20;z<12;z+=4){const rib=new THREE.Mesh(new THREE.BoxGeometry(.2,3.8,.5),new THREE.MeshStandardMaterial({color:0x3a231a,roughness:.9}));rib.position.set(side*2.4,1.9,z);lobbyScene.add(rib)}}
const lobbyFloor=new THREE.Mesh(new THREE.BoxGeometry(5.6,.2,34),new THREE.MeshStandardMaterial({color:0x1d1310,roughness:1}));lobbyFloor.position.set(0,-.1,-4);lobbyScene.add(lobbyFloor);
const lobbyCeil=new THREE.Mesh(new THREE.BoxGeometry(5.6,.2,34),new THREE.MeshStandardMaterial({color:0x120b09,roughness:1}));lobbyCeil.position.set(0,3.7,-4);lobbyScene.add(lobbyCeil);
const lobbyLamp=new THREE.PointLight(0xff4a1c,9,14);lobbyLamp.position.set(0,2.8,4);lobbyScene.add(lobbyLamp);
const lobbyLamp2=new THREE.PointLight(0xff2f0e,10,16);lobbyLamp2.position.set(0,2.6,-8);lobbyScene.add(lobbyLamp2);
const lobbyGlow=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.4),new THREE.MeshBasicMaterial({color:0xff3a12}));
lobbyGlow.position.set(0,3.2,-8);lobbyScene.add(lobbyGlow);
let lobbyZ=-14,lobbyTime=0;

// ---------------------------------------------------------------- lift + rooms
function lift(together){
 modal.hidden=true;inTransition=true;
 const screen=$('#lift-screen');screen.hidden=false;$('#lift-text').textContent='Лифт спускается...';
 const friend=[...others.values()][0];
 lift3d.start(together,friend?.skin||'deadpool');
 lastLiftStart=performance.now();soundLift();
 setTimeout(()=>{$('#lift-text').textContent='Двери открываются'},3200);
 setTimeout(()=>{screen.hidden=true;lastLiftStart=0;setRoom('basement');send({type:'lift-arrived'});inTransition=false},5500)}
function setRoom(next){
 room=next;
 $('#hud').classList.toggle('in-void',room==='void');
 mainRoom.visible=room==='main';basement.visible=room==='basement';voidRoom.visible=room==='void';
 $('#void-message').hidden=room!=='void';
 scene.background.set(room==='main'?0x140d0b:room==='basement'?0x17110d:0x050303);
 scene.fog.color.copy(scene.background);
 scene.fog.near=room==='main'?8:room==='basement'?9:6;
 scene.fog.far=room==='main'?27:room==='basement'?34:22;
 ambient.intensity=room==='main'?1.35:room==='basement'?1.15:.3;
 light.intensity=room==='main'?1.0:room==='basement'?.42:.1;
 torch.intensity=room==='basement'?110:0;
 torchFill.intensity=room==='basement'?4:0;
 pitLight.intensity=room==='main'?16:0;
 $('#inventory').hidden=room!=='basement';
 $('#mic').hidden=!voice.enabled;
 $('#ammo').hidden=room!=='basement'||!puzzle[ownWeapon];
 $('#fire').hidden=room!=='basement';
 pos.set(room==='basement'?(selfSlot?-.7:.7):4.5,1.65,room==='basement'?(n-1)/2*4-1:room==='main'?0:2);
 portalReady=performance.now()+1600;
 for(const p of others.values())p.group.visible=room!=='void'&&sameLocation(p);
 monster.group.visible=room==='basement'&&monsterUpdated>0;
 updateInventory();updateAction();
}
let rescueTick=0;
function updateRescue(){
 if(room!=='basement'||selfDown||overShown||inTransition){rescueButton.hidden=true;currentRescue=null;return}
 let best=null,bestDistance=3.6;
 for(const [id,downed] of downedOthers){
  const distance=Math.hypot(pos.x-downed.x,pos.z-downed.z);
  const facing=Math.atan2(-(downed.x-pos.x),-(downed.z-pos.z));
  const diff=Math.abs(Math.atan2(Math.sin(facing-yaw),Math.cos(facing-yaw)));
  if(distance<bestDistance&&diff<1.05){bestDistance=distance;best={...downed,id,distance}}
 }
 currentRescue=best;
 rescueButton.hidden=!best;
 if(best)rescueButton.textContent=`СПАСТИ ${best.name} — держи`;
 if(!best&&rescueHolding){rescueHolding=false;send({type:'rescue',on:false})}
 const now=performance.now();
 if(selfDown&&now>rescueTick){rescueTick=now+500;deadText.textContent=`Друг может спасти тебя. Осталось ${clockText(downUntil-Date.now())}`}
}
function updateMonsterMusic(){
 const active=room==='basement'&&monster.group.visible&&!monsterSleeping&&!overShown&&performance.now()>musicMuteUntil;
 if(!active){if(!monsterMusic.paused)monsterMusic.pause();monsterMusic.volume=0;return}
 const distance=Math.hypot(pos.x-monster.group.position.x,pos.z-monster.group.position.z);
 const volume=THREE.MathUtils.clamp((11-distance)/9,0,1);
 if(volume<=.02){if(!monsterMusic.paused)monsterMusic.pause();return}
 if(musicFailed){
  // No music file yet: a low pulse that gets faster as he gets closer.
  const now=performance.now(),interval=260+volume*900;
  if(now-lastHeart>1300-interval*.7){lastHeart=now;tone(48+volume*22,.22,'sine',.05+volume*.05,36)}
  return
 }
 monsterMusic.volume=Math.min(1,volume)*.9;
 if(monsterMusic.paused)monsterMusic.play().catch(()=>{musicFailed=true});
}
function sameLocation(p){return p.room===room&&(room==='main'||(sessionId!==null&&p.instance===sessionId))}

// ---------------------------------------------------------------- inventory and actions
function makeHeldModel(item){
 if(!item)return null;
 if(item==='hammer'||item==='crowbar'){const tool=makeTool(item);tool.rotation.z=-.35;tool.position.set(.02,-.1,-.05);return tool}
 const weapon=makeWeapon(item==='akB'?0x1f4f9c:0x9c2b1c);weapon.rotation.y=-.1;weapon.position.set(.02,-.06,-.18);return weapon}
function setEquipped(item,notifyServer=true){
 equipped=item;
 held.clear();heldWeapon=makeHeldModel(item);
 if(heldWeapon)held.add(heldWeapon);
 for(const name of ['hammer','crowbar','akA','akB'])$(`#slot-${name}`)?.classList.toggle('selected',item===name);
 if(notifyServer)send({type:'equip',item});
}
function updateInventory(){
 const weaponName=ownWeapon;
 for(const name of ['hammer','crowbar']){const button=$(`#slot-${name}`);button.disabled=!puzzle[name]}
 for(const name of WEAPONS){const button=$(`#slot-${name}`);if(button)button.disabled=!puzzle[name]||name!==weaponName||sessionId===null}
 const weaponButton=$('#slot-weapon');
 weaponButton.disabled=!puzzle[weaponName]||sessionId===null;
 weaponButton.querySelector('span').textContent=WEAPON_LABEL[weaponName]||'АК-47';
 weaponButton.dataset.color=weaponName;
 $('#ammo').textContent=`${ammo} / ${MAG}`;
 $('#fire').hidden=room!=='basement'||!puzzle[weaponName];
}
function updatePuzzle(p){puzzle=p;if(maze)updateMaze(maze,p);updateInventory()}
function equipOther(p,item){
 if(p.character){if(p.heldModel)p.heldModel.parent?.remove(p.heldModel);p.heldModel=null;
  if(item){const model=makeHeldModel(item);model.scale.setScalar(.85);p.heldModel=model;p.character.hand?.add(model)}}}
function updateAction(){
 if(room!=='basement'||inTransition){action.hidden=true;return}
 const near=(x,z)=>Math.hypot(pos.x-x,pos.z-z)<2.6;
 const spot=name=>spots.find(s=>s.name===name);
 const available=name=>spot(name)&&!puzzle[name]&&near(spot(name).x,spot(name).z);
 activeTarget=available('hammer')?'hammer':available('crowbar')?'crowbar':
  WEAPONS.some(w=>available(w)&&w===ownWeapon)?ownWeapon:
  WEAPONS.some(w=>available(w))?'other-weapon':
  near(0,-1.2)?'door':near(-2.6,(n-1)/2*4+2-.14)?'rules':null;
 action.hidden=!activeTarget;
 action.textContent=({rules:'Правила',hammer:'Взять молоток',crowbar:'Взять гвоздодёр',akA:'Взять красный АК-47',akB:'Взять синий АК-47','other-weapon':'Чужое оружие',door:'Осмотреть дверь'})[activeTarget]||'';
}
action.onclick=()=>{
 if(!activeTarget)return;
 if(activeTarget==='rules'){
  showDialog('Правила',coopMode
   ?'Вдвоём нужно найти четыре предмета: гвоздодёр, молоток и по одному АК-47 каждому. Оружие игрока один нельзя взять игроку два. Дверь в центре открывается гвоздодёром и молотком, но пройти можно только когда найдены оба АК-47. Майкл слышит шум: 10 попаданий отправляют его в спячку на 15 секунд. Зелёный квадрат у лифта — безопасная зона.'
   :'Один в лабиринте: найди гвоздодёр, молоток и свой АК-47. Открой центральную дверь гвоздодёром и молотком, затем войди. 10 попаданий из АК-47 усыпляют Майкла на 15 секунд. Зелёный квадрат у лифта — безопасная зона.',
   [['Понятно',()=>modal.hidden=true]]);
  return}
 if(activeTarget==='other-weapon'){notify('Это оружие второго игрока. Возьми своё.');return}
 send({type:'interact',target:activeTarget});
 if(activeTarget==='akA'||activeTarget==='akB')toolUseUntil=performance.now()+0;
};
for(const name of ['hammer','crowbar','weapon']){
 const button=$(`#slot-${name}`);
 button.onclick=()=>{
  const item=name==='weapon'?ownWeapon:name;
  if(!puzzle[item])return;
  setEquipped(item);
 }}

// ---------------------------------------------------------------- shooting
function fireOnce(){
 const now=performance.now();
 if(room!=='basement'||!puzzle[ownWeapon])return;
 if(equipped!==ownWeapon)setEquipped(ownWeapon);
 if(now<reloadUntil||ammo<=0){if(ammo<=0&&now>reloadUntil)reload();return}
 if(now-lastShot<115)return;
 lastShot=now;ammo--;updateInventory();
 send({type:'shoot'});
 gunshot(0);
 muzzle.intensity=4.5;
 setTimeout(()=>muzzle.intensity=0,45);
 pitch=Math.min(1.2,pitch+.012);
}
function reload(){
 if(ammo>=MAG||performance.now()<reloadUntil)return;
 send({type:'reload'});reloadSound();
 reloadUntil=performance.now()+1700;
 setTimeout(()=>{ammo=MAG;updateInventory()},1700);
}
let currentRescue=null;
rescueButton.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();
 if(!currentRescue)return;rescueHolding=true;send({type:'rescue',on:true,target:currentRescue.id})});
for(const type of ['pointerup','pointercancel','lostpointercapture'])rescueButton.addEventListener(type,()=>{
 if(rescueHolding){rescueHolding=false;send({type:'rescue',on:false})}});
for(const type of ['touchstart','touchmove','touchend'])rescueButton.addEventListener(type,event=>event.stopPropagation(),{passive:true});
const fireButton=$('#fire'),reloadButton=$('#reload');
fireButton.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();shooting=true;fireOnce();fireButton.setPointerCapture(event.pointerId)});
for(const type of ['pointerup','pointercancel','lostpointercapture'])fireButton.addEventListener(type,()=>shooting=false);
for(const type of ['touchstart','touchmove','touchend'])fireButton.addEventListener(type,event=>event.stopPropagation(),{passive:true});
reloadButton.addEventListener('click',event=>{event.stopPropagation();reload()});

// ---------------------------------------------------------------- input
const joystick=$('#joystick'),stick=$('#stick');
let joystickPointer=null,lookPointer=null,lookLast={x:0,y:0};
joystick.addEventListener('pointerdown',event=>{event.preventDefault();joystickPointer={id:event.pointerId,cx:event.clientX,cy:event.clientY};joystick.setPointerCapture(event.pointerId)});
joystick.addEventListener('pointermove',event=>{
 if(!joystickPointer||event.pointerId!==joystickPointer.id)return;
 const dx=event.clientX-joystickPointer.cx,dy=event.clientY-joystickPointer.cy,radius=44,length=Math.hypot(dx,dy);
 const clamped=Math.min(1,length/radius),angle=Math.atan2(dy,dx);
 move.x=Math.cos(angle)*clamped;move.y=Math.sin(angle)*clamped;
 stick.style.transform=`translate(${Math.cos(angle)*clamped*radius}px,${Math.sin(angle)*clamped*radius}px)`});
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{joystickPointer=null;move.x=0;move.y=0;stick.style.transform='translate(0,0)'});
renderer.domElement.addEventListener('pointerdown',event=>{if(!playing)return;lookPointer={id:event.pointerId,x:event.clientX,y:event.clientY};renderer.domElement.setPointerCapture(event.pointerId)});
renderer.domElement.addEventListener('pointermove',event=>{
 if(!lookPointer||event.pointerId!==lookPointer.id)return;
 yaw-=(event.clientX-lookPointer.x)*.0045;pitch=THREE.MathUtils.clamp(pitch-(event.clientY-lookPointer.y)*.0045,-1.2,1.2);
 lookPointer.x=event.clientX;lookPointer.y=event.clientY});
for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,()=>lookPointer=null);
addEventListener('keydown',event=>{keys[event.code]=true;if(event.code==='KeyR')reload();if(event.code==='Space'){event.preventDefault();jump()}});
function jump(){if(room==='void'||vertical>0||!playing||inTransition||selfDown||overShown)return;jumpVelocity=4.6;footstep(false,.5)}
addEventListener('keyup',event=>keys[event.code]=false);
const jumpButton=$('#jump');
if(jumpButton){
 jumpButton.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();jump()});
 for(const type of ['touchstart','touchmove','touchend'])jumpButton.addEventListener(type,event=>event.stopPropagation(),{passive:true});
}
addEventListener('blur',()=>{keys={};move={x:0,y:0};shooting=false;sprinting=false});
const sprintButton=$('#sprint');
sprintButton.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();sprinting=true;sprintButton.setPointerCapture(event.pointerId)});
for(const type of ['pointerup','pointercancel','lostpointercapture'])sprintButton.addEventListener(type,()=>sprinting=false);
for(const type of ['touchstart','touchmove','touchend'])sprintButton.addEventListener(type,event=>event.stopPropagation(),{passive:true});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();lobbyCamera.aspect=camera.aspect;lobbyCamera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

// ---------------------------------------------------------------- network
function label(text){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
 ctx.font='bold 44px Arial';ctx.textAlign='center';ctx.fillStyle='#ffcaa8';ctx.shadowColor='#5c1408';ctx.shadowBlur=10;ctx.fillText(text,256,78);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));
 sprite.scale.set(2.2,.55,1);sprite.position.y=2.35;return sprite}
function addPlayer(p){
 if(others.has(p.id))return;
 const character=createCharacter(p.skin),group=character.group;
 group.add(label(p.name));group.position.set(p.x,p.y||0,p.z);group.rotation.y=p.rotation;
 group.visible=(p.room||'main')===room&&(room==='main'||p.instance===sessionId);
 scene.add(group);
 others.set(p.id,{group,character,target:new THREE.Vector3(p.x,p.y||0,p.z),rotation:p.rotation,room:p.room||'main',instance:p.instance??null,
  skin:p.skin,lastMove:0,lastStepSound:0,equipped:p.equipped||null,heldModel:null,toolUseUntil:0,running:false});
 updateCount();
}
function updateCount(){$('#count').textContent=others.size+1}
function connect(){
 const name=$('#nickname').value.trim()||'Игрок';
 localStorage.setItem('deni-name',name);
 const button=$('#play');if(button.disabled)return;
 button.disabled=true;$('#status').textContent='ПОДКЛЮЧАЕМСЯ...';
 socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
 socket.onopen=()=>socket.send(JSON.stringify({type:'join',name,skin:$('#skin').value}));
 socket.binaryType='arraybuffer';
 socket.onmessage=event=>{
  if(typeof event.data!=='string'){voice.play(event.data);return}
  let message;try{message=JSON.parse(event.data)}catch{return}handle(message)};
 socket.onclose=()=>{voice.stop();button.disabled=false;shooting=false;
  if(playing){playing=false;$('#connection').hidden=false}else $('#status').textContent='НЕ УДАЛОСЬ ПОДКЛЮЧИТЬСЯ. ПОПРОБУЙ ЕЩЁ РАЗ.'}
}
function handle(message){
 switch(message.type){
  case 'welcome':
   selfId=message.id;voice.setId(message.id);$('#mic').hidden=!voice.enabled;yaw=Math.PI;pos.set(message.player.x,1.65,message.player.z);
   message.players.forEach(addPlayer);playing=true;updateCount();
   $('#stamina').hidden=false;$('#sprint').hidden=false;$('#jump').hidden=false;$('#lobby').style.display='none';$('#hud').hidden=false;setRoom('main');
   break;
  case 'choice':{
   let seconds=15;
   showDialog('Куда дальше?','Спуститься одному или подождать друга? Осталось 15 секунд.',[['Одному',()=>{modal.hidden=true;send({type:'lift-choice',choice:'solo'})}],['Подождать друга',()=>send({type:'lift-choice',choice:'together'})]]);
   clearInterval(window.choiceCountdown);
   window.choiceCountdown=setInterval(()=>{seconds--;if(seconds<=0||modal.hidden){clearInterval(window.choiceCountdown);return}
    $('#modal-text').textContent=`Спуститься одному или подождать друга? Осталось ${seconds} сек.`},1000);
   break}
  case 'waiting':clearInterval(window.choiceCountdown);showDialog('Ждём друга','Когда друг тоже прыгнет в бездну, вы спуститесь вместе.',[['Одному',()=>{modal.hidden=true;send({type:'lift-choice',choice:'solo'})}]]);break;
  case 'lift':{
   clearInterval(window.choiceCountdown);
   sessionId=message.instance;n=message.n;mazeSeed=message.seed||0;coopMode=!!message.together;selfSlot=message.slot;ownWeapon=message.own;spots=message.spots;ammo=message.ammo;reloadUntil=0;
   if(maze){basement.remove(maze.group);maze=null}
   maze=createMaze(n,mazeSeed);basement.add(maze.group);placeSpots(maze,spots);updatePuzzle(message.puzzle);
   setEquipped(null,false);monsterUpdated=0;monsterSleeping=false;monster.group.visible=false;
   lift(message.together);
   break}
  case 'voice-peers':voice.sync(message.peers);break;
  case 'voice-signal':voice.onSignal(message.from,message.data);break;
  case 'equip':
   if(message.id===selfId)setEquipped(message.item,false);
   else{const p=others.get(message.id);if(p){p.equipped=message.item;equipOther(p,message.item)}}
   break;
  case 'use-tool':
   if(message.id!==selfId){const p=others.get(message.id);if(p)p.toolUseUntil=performance.now()+650}
   playSound(message.item==='door'?'door':'tool');
   break;
  case 'shot':{
   const now=performance.now();
   if(message.id!==selfId){const p=others.get(message.id);
    if(p){p.toolUseUntil=now+300;gunshot(p.group.position.distanceTo(pos))}else gunshot(12)}
   if(message.hit)notify('Попадание в Майкла.');break}
  case 'ammo':ammo=message.ammo;updateInventory();break;
  case 'reload':if(message.until)reloadUntil=performance.now()+1700;break;
  case 'monster':
   monsterTarget.set(message.x,0,message.z);if(!monsterUpdated)monster.group.position.copy(monsterTarget);
   monsterRotation=message.rotation;monsterChasing=!!message.chasing;monsterSleeping=!!message.sleeping;
   monsterUpdated=performance.now();monster.group.visible=room==='basement';break;
  case 'monster-sleep':monsterSleeping=true;playSound('sleep');notify('Майкл упал. 15 секунд у вас есть.');break;
  case 'monster-wake':monsterSleeping=false;notify('Майкл встал.');break;
  case 'caught':pos.set(message.x,1.65,message.z);vertical=0;jumpVelocity=0;notify('Майкл поймал тебя. Ты у лифта.');playSound('caught');break;
  case 'killed':playKill();break;
  case 'downed':{
   downedOthers.set(message.id,{name:message.name,x:message.x,z:message.z,until:message.until});
   if(message.id===selfId)playKill();else tone(190,.5,'sawtooth',.07,90);
   showBanner(`${message.name} убит. У вас ${clockText(message.until-Date.now())}, чтобы его спасти.`);
   break}
  case 'you-downed':{
   if(!downedOthers.has(selfId))playKill();
   selfDown=true;downUntil=message.until;shooting=false;sprinting=false;move.x=0;move.y=0;
   deadScreen.hidden=false;deadText.textContent=`Друг может спасти тебя. Осталось ${clockText(downUntil-Date.now())}`;
   showBanner('Ты убит. Жди спасения — друг должен найти тебя и зажать «СПАСТИ».');
   break}
  case 'rescue':{
   const progress=Number(message.progress)||0;
   rescueBar.hidden=progress<=0;
   rescueFill.style.width=`${Math.round(progress*100)}%`;
   if(message.interrupted&&selfDown)deadText.textContent='Майкл стоит рядом. Друг должен отогнать его или усыпить.';
   else if(message.interrupted)showBanner('Майкл рядом — держи дистанцию или стреляй, иначе он помешает.',3000);
   break}
  case 'revived':{
   downedOthers.delete(message.id);rescueBar.hidden=true;rescueFill.style.width='0%';rescueHolding=false;
   if(message.id===selfId){selfDown=false;deadScreen.hidden=true;notify('Тебя спасли!')}
   else showBanner(`${message.name} снова на ногах.`);
   break}
  case 'over':{
   overShown=true;overScreen.hidden=false;overText.textContent=message.reason||'Майкл победил.';
   deadScreen.hidden=true;rescueButton.hidden=true;rescueBar.hidden=true;break}
  case 'enter-void':setRoom('void');break;
  case 'spots':{spots=message.spots;if(maze)placeSpots(maze,spots);break}
  case 'puzzle':{
   const hadWeapon=puzzle[ownWeapon];updatePuzzle(message.puzzle);
   if(ownWeapon&&puzzle[ownWeapon]&&!hadWeapon){setEquipped(ownWeapon);notify('Оружие у тебя в руках. Стреляй кнопкой ОГОНЬ.')}
   break}
  case 'message':notify(message.text);break;
  case 'join':addPlayer(message.player);break;
  case 'leave':{const p=others.get(message.id);if(p){scene.remove(p.group);others.delete(message.id);updateCount()}break}
  case 'move':{
   const p=others.get(message.id);if(!p)break;
   if(Math.hypot(message.x-p.target.x,message.z-p.target.z)>.002)p.lastMove=performance.now();
   p.target.set(message.x,message.y||0,message.z);p.rotation=message.rotation;p.room=message.room||'main';p.instance=message.instance??null;p.running=!!message.running;p.down=!!message.down;
   p.group.visible=room!=='void'&&sameLocation(p);
   if(message.equipped!==undefined&&message.equipped!==p.equipped){p.equipped=message.equipped;equipOther(p,message.equipped)}
   break}
 }
}
$('#nickname').value=localStorage.getItem('deni-name')||'';
$('#play').onclick=()=>{unlockAudio();unlockAudio_();connect()};
$('#nickname').addEventListener('keydown',event=>{if(event.key==='Enter')connect()});
$('#reconnect').onclick=()=>location.reload();

// ---------------------------------------------------------------- main loop
let last=performance.now(),lastSend=0;
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(playing){updateGame(now,dt)}else{updateLobby(now,dt)}
 if(inTransition&&lastLiftStart)lift3d.update((now-lastLiftStart)/1000,dt);
 if(inTransition&&lastLiftStart)renderer.render(lift3d.scene,lift3d.camera);
 else renderer.render(playing?scene:lobbyScene,playing?camera:lobbyCamera);
}
function updateLobby(now,dt){
 lobbyTime+=dt;
 lobbyZ+=dt*.85;if(lobbyZ>9)lobbyZ=-16;
 lobbyMonster.group.position.set(Math.sin(lobbyTime*.6)*.35,0,lobbyZ);
 lobbyMonster.group.rotation.y=0;
 animateMonster(lobbyMonster,dt,true,false);
 lobbyCamera.position.x=Math.sin(lobbyTime*.25)*.25;
 lobbyCamera.position.y=1.7+Math.sin(lobbyTime*.7)*.02;
 lobbyCamera.lookAt(0,1.3,lobbyZ-4);
 lobbyGlow.material.color.setHSL(.045,.9,.45+Math.sin(lobbyTime*2)*.05);
}
function updateGame(now,dt){
 let x=move.x+(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
 let y=move.y+(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
 const length=Math.hypot(x,y);if(length>1){x/=length;y/=length}
 if(inTransition||!modal.hidden||!settings.hidden||selfDown||overShown){x=0;y=0}
 const running=(sprinting||keys.ShiftLeft||keys.ShiftRight)&&!exhausted&&stamina>0&&Math.hypot(x,y)>.1&&!inTransition&&modal.hidden&&settings.hidden;
 stamina=THREE.MathUtils.clamp(stamina+(running?-24:14)*dt,0,100);
 if(stamina<=0)exhausted=true;else if(stamina>=25)exhausted=false;
 $('#stamina-value').textContent=Math.round(stamina);$('#stamina-fill').style.width=`${stamina}%`;
 const speed=running?5.8:3.4,limit=room==='basement'?limitFor(n):8.4;
 const stepX=x*Math.cos(yaw)+y*Math.sin(yaw),stepZ=-x*Math.sin(yaw)+y*Math.cos(yaw);
 const nx=THREE.MathUtils.clamp(pos.x+stepX*speed*dt,-limit,limit),nz=THREE.MathUtils.clamp(pos.z+stepZ*speed*dt,-limit,limit);
 if(room!=='basement'||walkable(nx,pos.z))pos.x=nx;
 if(room!=='basement'||walkable(pos.x,nz))pos.z=nz;
 if(now>portalReady&&!inTransition&&room==='main'&&pos.x>3.1&&pos.x<5.9&&pos.z<-5.0&&pos.z>-8)fall();
 updateRescue();updateMonsterMusic();
 jumpVelocity-=12*dt;vertical=Math.max(0,vertical+jumpVelocity*dt);if(vertical===0)jumpVelocity=0;
 camera.position.copy(pos);camera.position.y+=vertical;
 if(selfDown)camera.position.y=.55;
 camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
 if(selfDown||overShown){shooting=false;rescueHolding=false}
 if(shooting&&now-lastShot>115)fireOnce();
 if(now-lastSend>50&&socket?.readyState===WebSocket.OPEN){
  socket.send(JSON.stringify({type:'move',x:pos.x,z:pos.z,rotation:yaw,room,y:vertical,running}));lastSend=now}
 for(const p of others.values()){
  p.group.position.lerp(p.target,Math.min(1,dt*12));p.group.rotation.y=p.rotation;
  const lying=p.down?1:0;p.group.rotation.z+=(lying*Math.PI/2.05-p.group.rotation.z)*Math.min(1,dt*6);p.group.position.y+=(lying*.45-p.group.position.y)*Math.min(1,dt*6);
  const moving=now-p.lastMove<220;
  animateCharacter(p.character,dt,moving,p.running);
  if(p.toolUseUntil>now&&p.heldModel)p.heldModel.rotation.x=-.6-Math.sin((p.toolUseUntil-now)/650*Math.PI)*.9;
  const stepDistance=p.group.position.distanceTo(pos);
  if(p.group.visible&&moving&&stepDistance<9&&now-(p.lastStepSound||0)>(p.running?300:520)){footstep(!!p.running,Math.max(0,1-stepDistance/9)*1.2);p.lastStepSound=now}
 }
 if(room==='basement'&&monsterUpdated){
  const moving=monster.group.position.distanceTo(monsterTarget)>.03;
  monster.group.position.lerp(monsterTarget,Math.min(1,dt*9));monster.group.rotation.y=monsterRotation;
  animateMonster(monster,dt,moving,monsterChasing,monsterSleeping);
 }
 held.visible=room==='basement'&&!!equipped;
 held.position.y=-.5+Math.sin(now*.0016)*.006+(equipped&&WEAPONS.includes(equipped)?-.02:0);
 held.rotation.x=(toolUseUntil>now&&!WEAPONS.includes(equipped||''))?Math.sin((toolUseUntil-now)/650*Math.PI)*-.9:0;
 if(Math.hypot(x,y)>.1&&!inTransition&&modal.hidden&&settings.hidden&&now-(window.lastFootstep||0)>(running?290:500)){footstep(running);window.lastFootstep=now}
 updateAction();
}
function walkable(x,z){
 if(!maze||!canWalk(maze.walls,x,z))return false;
 if(puzzle.door)return true;
 return !(Math.abs(x)<1.15&&Math.abs(z-maze.door.z)<.4)
}
function fall(){
 inTransition=true;move={x:0,y:0};keys={};room='lift';
 for(const p of others.values())p.group.visible=false;
 send({type:'fall'});
}
preloadCharacters();
// Installable app: on Android this opens without the browser address bar.
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
let installPrompt=null;const installButton=$('#install-btn');
const isApple=/iPhone|iPad|iPod/i.test(navigator.userAgent);
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event});
installButton?.addEventListener('click',async()=>{
 if(installPrompt){
  installPrompt.prompt();
  try{await installPrompt.userChoice}catch{}
  installPrompt=null;return;
 }
 showDialog('Установить на телефон',isApple
  ?'Нажми «Поделиться» (квадрат со стрелкой внизу) и выбери «На экран Домой». Игра откроется с иконки, без строки браузера.'
  :'Открой меню браузера (три точки ⋮ справа сверху) и выбери «Установить приложение» или «Добавить на главный экран». После этого игра запускается с иконки, без адресной строки, и работает онлайн.',
  [['Понятно',()=>modal.hidden=true]]);
});
requestAnimationFrame(frame);
