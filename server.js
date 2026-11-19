import express from 'express';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { gridFor, limitFor, entryFor, layout, isSafe, randomSpots, cellAt, doorFor, CELL, cellCenter } from './public/layout.js';

const app=express(),BUILD=(process.env.RENDER_GIT_COMMIT||process.env.GIT_COMMIT||'local').slice(0,7);
const indexHtml=readFileSync('public/index.html','utf8');
app.get('/',(req,res)=>{res.set('Cache-Control','no-store');res.type('html').send(indexHtml.replace('/game.js',`/game.js?v=${BUILD}`).replace('/style.css',`/style.css?v=${BUILD}`))});
app.get('/api/version',(req,res)=>{res.set('Cache-Control','no-store');res.json({build:BUILD})});
let lastVisit=null;app.get('/api/history',(req,res)=>res.json({lastVisit}));
function cacheHeaders(res,path){if(path.endsWith('.html')||path.endsWith('.webmanifest')||path.endsWith('sw.js'))res.setHeader('Cache-Control','no-store');else if(path.endsWith('.js'))res.setHeader('Cache-Control','no-cache');else res.setHeader('Cache-Control','public, max-age=86400')}
app.use('/vendor/three/addons',express.static('node_modules/three/examples/jsm',{setHeaders:cacheHeaders}));
app.use('/vendor/three',express.static('node_modules/three/build',{setHeaders:cacheHeaders}));
app.use(express.static('public',{setHeaders:cacheHeaders}));

const server=createServer(app),wss=new WebSocketServer({server}),players=new Map(),instances=new Map();
let nextId=1,nextInstance=1,waiting=null;
const WEAPONS=['akA','akB'],WEAPON_NAMES={akA:'красный АК-47',akB:'синий АК-47'},MAG=30,SLEEP_MS=15000,HITS_TO_SLEEP=10,RESCUE_MS=120000,REVIVE_MS=15000;
const freshPuzzle=()=>({crowbar:false,hammer:false,akA:false,akB:false,rpg:false,cameraA:false,cameraB:false,nails:false,boards:false,door:false});
const send=(socket,data)=>{if(socket?.readyState===1)socket.send(JSON.stringify(data))};
const broadcast=(data,except)=>{for(const c of wss.clients)if(c!==except)send(c,data)};
const inInstance=(id,data,except)=>{for(const p of players.values())if(p.instance===id&&p.socket!==except)send(p.socket,data)};
const instancePlayers=id=>[...players.values()].filter(p=>p.instance===id);
const publicPlayer=p=>{const {socket,status,choiceTimer,noiseUntil,noiseLoudUntil,...rest}=p;return rest};
const instanceFor=p=>instances.get(p.instance);

function startLift(ids){
 const instance=nextInstance++,coop=ids.length>1,n=gridFor(coop),names=coop?['crowbar','hammer','akA','akB','rpg','cameraA','cameraB']:['crowbar','hammer','akA','rpg','cameraA'];
 const seed=Math.floor(Math.random()*1e6),session={id:instance,n,coop,seed,cells:layout(n,seed),puzzle:freshPuzzle(),spots:randomSpots(n,names,Math.random,seed),monster:{x:0,z:-CELL,rotation:0,target:null,until:0,patrol:null,hp:0,sleepUntil:0},slots:new Map()};
 instances.set(instance,session);
 ids.sort((a,b)=>a-b).forEach((id,index)=>session.slots.set(id,index));
 for(const id of ids){const p=players.get(id);if(!p)continue;
  clearTimeout(p.choiceTimer);p.status='lift';p.room='lift';p.instance=instance;p.slot=session.slots.get(id);p.ammo=MAG;p.ammoPool=MAG;p.reloadUntil=0;
  const own=WEAPONS[p.slot];
  send(p.socket,{type:'lift',together:coop,instance,n,seed,slot:p.slot,own,spots:session.spots,puzzle:session.puzzle,ammo:p.ammo,safe:isSafe(n,0,entryFor(n).z)});
  broadcast({type:'move',...publicPlayer(p)},p.socket)}
 if(ids.includes(waiting))waiting=null;
 refreshVoice();
}
const RESPAWN=['crowbar','hammer','akA','akB','rpg','cameraA','cameraB'];
function respot(session){
 const names=RESPAWN.filter(name=>!session.puzzle[name]);
 if(!names.length)return;
 const fresh=randomSpots(session.n,names,Math.random,session.seed);
 session.spots=session.spots.map(old=>fresh.find(f=>f.name===old.name)||old);
 inInstance(session.id,{type:'spots',spots:session.spots});
}
function sameVoice(a,b){return a&&b&&a.id!==b.id&&((a.room==='main'&&b.room==='main')||(a.instance!==null&&a.instance===b.instance))}
function voicePeers(p){return [...players.values()].filter(q=>q.voice&&sameVoice(p,q)).map(q=>q.id)}
function refreshVoice(){for(const p of players.values())if(p.voice)send(p.socket,{type:'voice-peers',peers:voicePeers(p)})}

// --- maze-aware monster helpers -------------------------------------------------
function lineOfSight(n,cells,x1,z1,x2,z2,doorOpen=false){
 const center=Math.floor(n*n/2);
 const dist=Math.hypot(x2-x1,z2-z1),steps=Math.max(2,Math.ceil(dist/.35));
 let previous=cellAt(n,x1,z1);
 for(let i=1;i<=steps;i++){const t=i/steps,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t,current=cellAt(n,x,z);
  if(current!==previous){
   const a=previous,b=current,ax=a%n,az=Math.floor(a/n),bx=b%n,bz=Math.floor(b/n),dirs=[[0,-1],[1,0],[0,1],[-1,0]];
   let open=false;
   for(let d=0;d<4;d++)if(cells[a].open[d]&&(ax+dirs[d][0])+n*(az+dirs[d][1])===b)open=true;
   const throughDoor=doorOpen&&((a===center&&b===center-n)||(b===center&&a===center-n));
   if(!open&&!throughDoor)return false;
   previous=current}}
 return true;
}
function stepTowards(n,cells,start,end,blocked){if(start===end)return end;const dirs=[[0,-1],[1,0],[0,1],[-1,0]],queue=[start],prev=new Map([[start,-1]]);
 for(let k=0;k<queue.length;k++){const i=queue[k],x=i%n,z=Math.floor(i/n);
  for(let d=0;d<4;d++)if(cells[i].open[d]){const j=(z+dirs[d][1])*n+x+dirs[d][0];
   if(prev.has(j)||blocked(j))continue;prev.set(j,i);
   if(j===end){let cur=j;while(prev.get(cur)!==start&&prev.get(cur)!==-1)cur=prev.get(cur);return cur}
   queue.push(j)}}
 return null;
}

wss.on('connection',(socket,request)=>{
 const agent=request.headers['user-agent']||'',id=nextId++;
 socket.on('message',(raw,isBinary)=>{
  if(isBinary){
   // Voice goes through the same socket: it survives mobile NATs where peer to peer fails.
   const p=players.get(id);if(!p||!p.voice)return;
   const frame=Buffer.isBuffer(raw)?raw:Buffer.from(raw);
   if(!frame.length||frame.length>6000)return;
   const now=Date.now();
   if(now>p.audioStamp){p.audioStamp=now;p.audioBytes=0}
   p.audioBytes+=frame.length;
   if(p.audioBytes>96000)return;
   for(const q of players.values())if(q!==p&&q.voice&&sameVoice(p,q)&&q.socket.readyState===1)q.socket.send(frame,{binary:true});
   return}
  if(raw.length>16000)return;let m;try{m=JSON.parse(raw.toString())}catch{return}if(!m||typeof m!=='object')return;
  if(m.type==='join'&&!players.has(id)){
   const a=Math.random()*Math.PI*2,p={id,socket,status:'playing',name:String(m.name||'Игрок').trim().slice(0,20)||'Игрок',skin:m.skin==='batman'?'batman':'deadpool',room:'main',instance:null,slot:0,x:Math.cos(a)*2,z:Math.sin(a)*2,rotation:0,y:0,equipped:null,down:false,downUntil:0,reviveAt:0,rescuing:null,voice:false,audioBytes:0,audioStamp:0,noiseUntil:0,noiseLoudUntil:0,ammo:MAG,reloadUntil:0};
   players.set(id,p);const ua=String(agent);
   lastVisit={device:/iPhone|iPad/i.test(ua)?'iPhone / iPad':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh/i.test(ua)?'Mac':'другое устройство',time:new Date().toISOString()};
   send(socket,{type:'welcome',id,player:publicPlayer(p),players:[...players.values()].filter(q=>q.id!==id).map(publicPlayer),puzzle:freshPuzzle()});
   broadcast({type:'join',player:publicPlayer(p)},socket);
   return}
  const p=players.get(id);if(!p)return;
  if(m.type==='fall'){
   if(p.room!=='main'||p.status!=='playing'||p.instance!==null)return;
   p.status='choosing';p.room='lift';broadcast({type:'move',...publicPlayer(p)},socket);refreshVoice();
   if(waiting!==null&&waiting!==id&&players.has(waiting)){startLift([waiting,id])}
   else{send(socket,{type:'choice',seconds:15});p.choiceTimer=setTimeout(()=>{if(players.has(id)&&p.status==='choosing')startLift([id])},15000)}
  }else if(m.type==='lift-choice'){
   if(p.status!=='choosing'&&p.status!=='waiting')return;
   if(m.choice==='solo'){if(waiting===id)waiting=null;startLift([id])}
   else if(m.choice==='together'){
    clearTimeout(p.choiceTimer);
    if(waiting!==null&&waiting!==id&&players.has(waiting)){startLift([waiting,id])}
    else{waiting=id;p.status='waiting';send(socket,{type:'waiting'})}}
  }else if(m.type==='lift-arrived'){
   if(p.status!=='lift')return;const s=instanceFor(p);if(!s)return;
   p.status='playing';p.room='basement';p.x=id%2?-.7:.7;p.z=entryFor(s.n).z-1;
   broadcast({type:'move',...publicPlayer(p)},socket);
  }else if(m.type==='move'&&[m.x,m.z,m.rotation].every(Number.isFinite)){
   if(p.status!=='playing')return;const s=instanceFor(p),limit=s?limitFor(s.n):8.4,oldX=p.x,oldZ=p.z;
   p.x=Math.max(-limit,Math.min(limit,m.x));p.z=Math.max(-limit,Math.min(limit,m.z));p.rotation=m.rotation;
   p.y=Number.isFinite(m.y)?Math.max(0,Math.min(1.5,m.y)):0;p.running=!!m.running;
   if(Math.hypot(p.x-oldX,p.z-oldZ)>.015)p.noiseUntil=Date.now()+350;
   broadcast({type:'move',...publicPlayer(p)},socket);
  }else if(m.type==='equip'){
   const s=instanceFor(p);if(!s||p.room!=='basement')return;
   const item=['hammer','crowbar','akA','akB','rpg'].includes(m.item)?m.item:null;
   if(item&&!s.puzzle[item])return;
   if(item&&WEAPONS.includes(item)&&item!==WEAPONS[p.slot])return;
   p.equipped=item;broadcast({type:'equip',id,item,instance:p.instance},socket);
  }else if(m.type==='interact'){
   handleInteract(p,m,socket);
  }else if(m.type==='rescue'){
   console.log('RESCUE-MSG',JSON.stringify(m),'status',p.status,'room',p.room,'down',p.down);
   const s=instanceFor(p);if(!s||p.room!=='basement'||p.down||p.status!=='playing')return;
   const target=players.get(m.target);
   if(m.on&&target&&target.down&&target.instance===p.instance&&Math.hypot(target.x-p.x,target.z-p.z)<3.4)p.rescuing=target.id;
   else if(!m.on||p.rescuing===m.target)p.rescuing=null;
  }else if(m.type==='reload'){
   const s=instanceFor(p);if(!s||p.room!=='basement'||!p.equipped||!WEAPONS.includes(p.equipped))return;
   if(p.ammo>=MAG||p.reloadUntil>Date.now())return;
   p.reloadUntil=Date.now()+1700;send(socket,{type:'reload',until:p.reloadUntil});
   setTimeout(()=>{const cur=players.get(id);if(cur&&cur.ammo<MAG){cur.ammo=MAG;cur.reloadUntil=0;send(cur.socket,{type:'ammo',ammo:cur.ammo,reloading:false})}},1760);
  }else if(m.type==='shoot'){
   handleShoot(p);
  }else if(m.type==='rpg'){
   handleRPG(p);
  }else if(m.type==='camera'){
   const s2=instanceFor(p);if(!s2||p.room!=='basement')return;
   const mine=p.slot?'cameraB':'cameraA';
   send(socket,{type:'camera',ok:!!s2.puzzle[mine],spots:s2.spots,puzzle:s2.puzzle});
  }else if(m.type==='voice-ready'){
   p.voice=!!m.enabled;refreshVoice();
  }else if(m.type==='voice-signal'){
   const peer=players.get(m.to);if(p.voice&&peer?.voice&&sameVoice(p,peer)&&m.data&&typeof m.data==='object')send(peer.socket,{type:'voice-signal',from:id,data:m.data});
  }
 });
 socket.on('close',()=>{
  const p=players.get(id);if(waiting===id)waiting=null;clearTimeout(p?.choiceTimer);
  if(players.delete(id)){broadcast({type:'leave',id});
   if(p&&p.instance!==null&&!instancePlayers(p.instance).length)instances.delete(p.instance);
   refreshVoice()}
 });
});

function handleInteract(p,m,socket){
 const s=instanceFor(p);if(!s||p.status!=='playing'||p.room!=='basement')return;
 const puzzle=s.puzzle,own=WEAPONS[p.slot],near=(x,z)=>Math.hypot(p.x-x,p.z-z)<2.8;
 let result='',used=null,enter=false;
 const spot=name=>s.spots.find(item=>item.name===name);
 const pick=(name,label)=>{if(puzzle[name]||!near(spot(name).x,spot(name).z))return false;puzzle[name]=true;result=label;used=name;if(name===own){p.equipped=name;broadcast({type:'equip',id:p.id,item:name,instance:p.instance},socket)}return true};
 if(m.target==='cameraA'||m.target==='cameraB'){
  const mine=m.target===(p.slot?'cameraB':'cameraA');
  if(!mine){send(socket,{type:'message',text:'Это камера второго игрока. Ищи свою.'});return}
  if(pick(m.target,'Камера найдена! Нажми «КАМЕРА», чтобы посмотреть лабиринт.'))p.equipped=null;
 }else if(m.target==='rpg'){
  if(pick('rpg','РПГ найдена! Один выстрел, перезарядка 10 секунд.')){p.equipped='rpg';broadcast({type:'equip',id:p.id,item:'rpg',instance:p.instance},socket);send(socket,{type:'equip',id:p.id,item:'rpg'})}
 }else if(m.target==='hammer'||m.target==='crowbar'||m.target==='akA'||m.target==='akB'){
  if((m.target==='akA'||m.target==='akB')&&m.target!==own){send(socket,{type:'message',text:`Это ${WEAPON_NAMES[m.target]} второго игрока. Возьми своё оружие.`});return}
  if(m.target==='hammer')pick('hammer','Молоток найден!');
  else if(m.target==='crowbar')pick('crowbar','Гвоздодёр найден!');
  else pick(m.target,`${WEAPON_NAMES[m.target]} найден! 30 патронов.`);
  const targetSpot=spot(m.target);
  if(!result&&targetSpot&&!puzzle[m.target]&&!near(targetSpot.x,targetSpot.z))send(socket,{type:'message',text:'Подойди ближе к предмету.'});
 }else if(m.target==='door'&&near(0,-1.2)){
  const allWeapons=WEAPONS.filter(w=>s.slots.size>1||w==='akA').every(w=>puzzle[w]);
  if(!puzzle.nails){
   if(puzzle.crowbar&&p.equipped==='crowbar'){puzzle.nails=true;result='Гвозди вытащены.';used='crowbar'}
   else result='Возьми гвоздодёр и выбери его в инвентаре.'
  }else if(!puzzle.boards){
   if(puzzle.hammer&&p.equipped==='hammer'){puzzle.boards=true;result='Доски сняты.';used='hammer'}
   else result='Возьми молоток и выбери его в инвентаре.'
  }else if(!puzzle.door){puzzle.door=true;result='Дверь открыта.';used='door'}
  else if(!allWeapons){result=s.slots.size>1?'Дверь открыта, но нужно найти оба АК-47 — твой и друга.':'Дверь открыта, но сначала найди свой АК-47.'}
  else enter=true;
 }
 if(enter){p.room='void';p.x=0;p.z=0;send(socket,{type:'enter-void'});broadcast({type:'move',...publicPlayer(p)},socket);return}
 if(result){inInstance(p.instance,{type:'puzzle',puzzle});send(socket,{type:'message',text:result});
  if(used){p.noiseUntil=Date.now()+5000;p.noiseLoudUntil=Date.now()+5000;inInstance(p.instance,{type:'use-tool',id:p.id,item:used})}}
}

function handleRPG(p){
 const s=instanceFor(p);if(!s||p.room!=='basement'||p.equipped!=='rpg'||!s.puzzle.rpg)return;
 const now=Date.now();
 if(now<(p.rpgUntil||0))return;
 p.rpgUntil=now+10000;
 p.noiseLoudUntil=now+7000;p.noiseUntil=now+7000;
 const m=s.monster,n=s.n,cells=s.cells||layout(n,s.seed||0);
 const dx=m.x-p.x,dz=m.z-p.z,distance=Math.hypot(dx,dz);
 const facing=Math.atan2(-dx,-dz),diff=Math.abs(Math.atan2(Math.sin(facing-p.rotation),Math.cos(facing-p.rotation)));
 const los=lineOfSight(n,cells,p.x,p.z,m.x,m.z,s.puzzle.door);
 const hit=distance<26&&diff<.5&&los;
 const x=hit?m.x:p.x-Math.sin(p.rotation)*6,z=hit?m.z:p.z-Math.cos(p.rotation)*6;
 if(hit){
  m.hp=0;m.sleepUntil=now+20000;m.target=null;m.until=0;m.waypoint=null;
  inInstance(p.instance,{type:'monster-sleep',until:m.sleepUntil,explosion:true});
 }
 inInstance(p.instance,{type:'explosion',x,z,hit,by:p.id});
}

function handleShoot(p){
 const s=instanceFor(p);if(!s||p.room!=='basement'||!p.equipped||!WEAPONS.includes(p.equipped))return;
 const now=Date.now();
 if(p.equipped!==WEAPONS[p.slot]||!s.puzzle[p.equipped])return;
 // A finished reload always tops the magazine up, even if the timer message was lost.
 if(p.ammo<MAG&&p.reloadUntil&&now>=p.reloadUntil){p.ammo=MAG;p.reloadUntil=0;send(p.socket,{type:'ammo',ammo:p.ammo,reloading:false})}
 if(now<p.reloadUntil||p.ammo<=0)return;
 p.ammo--;p.noiseUntil=now+600;p.noiseLoudUntil=now+900;
 const m=s.monster,n=s.n,cells=s.cells||layout(n,s.seed||0);
 const dx=m.x-p.x,dz=m.z-p.z,distance=Math.hypot(dx,dz);
 const facing=Math.atan2(-dx,-dz),diff=Math.abs(Math.atan2(Math.sin(facing-p.rotation),Math.cos(facing-p.rotation)));
 const los=lineOfSight(n,cells,p.x,p.z,m.x,m.z,s.puzzle.door);
 const hit=distance<16&&diff<.42&&m.sleepUntil<now&&los;
 if(hit){
  m.hp++;
  if(m.hp>=HITS_TO_SLEEP){m.hp=0;m.sleepUntil=now+SLEEP_MS;m.target=null;m.until=0;m.waypoint=null;inInstance(p.instance,{type:'monster-sleep',until:m.sleepUntil})}
 }
 inInstance(p.instance,{type:'shot',id:p.id,ammo:p.ammo,hit,sleeping:m.sleepUntil>now});
 send(p.socket,{type:'ammo',ammo:p.ammo,reloading:p.reloadUntil>now});
}

const CELLS={};
const cellsFor=(n,seed=0)=>CELLS[n+':'+seed]||(CELLS[n+':'+seed]=layout(n,seed));
setInterval(()=>{
 const now=Date.now();
 for(const [id,session] of instances){
  const {monster:m,n}=session,cells=cellsFor(n,session.seed||0),entry=entryFor(n);
  const targets=instancePlayers(id).filter(p=>p.room==='basement'&&p.status==='playing'&&!p.down&&!isSafe(n,p.x,p.z));
  if(m.sleepUntil>now){inInstance(id,{type:'monster',x:m.x,z:m.z,rotation:m.rotation,chasing:false,sleeping:true});continue}
  if(m.sleepUntil&&m.sleepUntil<=now){m.sleepUntil=0;inInstance(id,{type:'monster-wake'})}
  const downedList=instancePlayers(id).filter(q=>q.down);
  for(const downed of downedList){
   if(now>downed.downUntil){
    downed.down=false;downed.reviveAt=0;
    for(const q of instancePlayers(id)){send(q.socket,{type:'over',reason:`${downed.name} не дождался помощи`});q.status='over'}
    session.over=true;
    continue}
   const rescuer=instancePlayers(id).find(q=>q.rescuing===downed.id&&!q.down&&Math.hypot(q.x-downed.x,q.z-downed.z)<3.2);
   if(rescuer){
    // Michael walks to the sound, but a rescue in progress is not an instant death.
    const near=now>(m.calmUntil||0)&&Math.hypot(m.x-downed.x,m.z-downed.z)<2.2;
    if(near){
     // He is standing over you: the rescue pauses, it does not fail. Shoot him or lead him away.
     inInstance(id,{type:'rescue',id:downed.id,by:rescuer.id,progress:downed.reviveAt/REVIVE_MS,interrupted:true});
    }else{
     downed.reviveAt=Math.min(REVIVE_MS,downed.reviveAt+100);
     if(now>m.calmUntil){m.target={x:downed.x,z:downed.z};m.until=now+4000;m.rescueTarget=true}
     inInstance(id,{type:'rescue',id:downed.id,by:rescuer.id,progress:downed.reviveAt/REVIVE_MS});
     if(downed.reviveAt>=REVIVE_MS){
      downed.down=false;downed.reviveAt=0;
      inInstance(id,{type:'revived',id:downed.id,name:downed.name});
      for(const q of instancePlayers(id))if(q.rescuing===downed.id)q.rescuing=null;
      m.target=null;m.until=0;m.rescueTarget=false;m.calmUntil=now+6000;
     }
    }
   }else if(downed.reviveAt){downed.reviveAt=Math.max(0,downed.reviveAt-60);inInstance(id,{type:'rescue',id:downed.id,by:null,progress:downed.reviveAt/REVIVE_MS})}
  }
  if(!instancePlayers(id).some(q=>q.rescuing))m.rescueTarget=false;
  if(!targets.length){inInstance(id,{type:'monster',x:m.x,z:m.z,rotation:m.rotation,chasing:false,sleeping:false});continue}
  let heard=null,best=Infinity;
  for(const p of targets){
   const distance=Math.hypot(p.x-m.x,p.z-m.z);
   const loud=p.noiseLoudUntil>now,noisy=p.noiseUntil>now;
   let range=4.5;                       // he feels people standing close
   if(loud)range=19;else if(noisy)range=p.running?15:8.5;
   if(distance>=range)continue;
   const los=distance<4.5||lineOfSight(n,cells,p.x,p.z,m.x,m.z,session.puzzle.door);
   if(los&&distance<best){best=distance;heard=p}}
  if(heard){m.target={x:heard.x,z:heard.z};m.until=now+8000}   // he remembers where you were
  if(now>m.until)m.target=null;
  if(!m.target&&(!m.patrol||Math.hypot(m.x-m.patrol.x,m.z-m.patrol.z)<.5)){
   let i;do{i=Math.floor(Math.random()*(n*n))}while(isSafe(n,...Object.values(cellCenter(n,i))));m.patrol=cellCenter(n,i)}
  const dest=m.target||m.patrol;
  if(!m.waypoint||Math.hypot(m.x-m.waypoint.x,m.z-m.waypoint.z)<.08){
   const start=cellAt(n,m.x,m.z),end=cellAt(n,dest.x,dest.z),step=stepTowards(n,cells,start,end,j=>isSafe(n,...Object.values(cellCenter(n,j))));
   if(step===null){m.target=null;m.patrol=null;m.waypoint=cellCenter(n,start)}
   else m.waypoint=step===start?{x:dest.x,z:dest.z}:cellCenter(n,step);
   if(isSafe(n,m.waypoint.x,m.waypoint.z))m.waypoint=cellCenter(n,start);
  }
  if(session.over)continue;
  const point=m.waypoint,dx=point.x-m.x,dz=point.z-m.z,distance=Math.hypot(dx,dz);
  if(distance>.05){const speed=m.rescueTarget?0.9:(m.target?4.6:1.8),amount=Math.min(distance,speed*.1);m.x+=dx/distance*amount;m.z+=dz/distance*amount;m.rotation=Math.atan2(-dx,-dz)}
  for(const p of targets)if(!p.rescuing&&now>(m.calmUntil||0)&&Math.hypot(p.x-m.x,p.z-m.z)<.85){
   const alive=instancePlayers(id).filter(q=>!q.down&&q.room==='basement');
   if(session.coop&&alive.length>1){
    p.down=true;p.downUntil=now+RESCUE_MS;p.reviveAt=0;p.noiseUntil=0;p.noiseLoudUntil=0;
    inInstance(id,{type:'downed',id:p.id,name:p.name,x:p.x,z:p.z,until:p.downUntil});
    send(p.socket,{type:'you-downed',until:p.downUntil});
    broadcast({type:'move',...publicPlayer(p)},p.socket);
    m.waypoint=null;m.rescueTarget=false;m.calmUntil=now+12000;respot(session);
    {let far;let guard=0;do{far=cellCenter(n,Math.floor(Math.random()*n*n));guard++}while(guard<40&&(isSafe(n,far.x,far.z)||Math.hypot(far.x-p.x,far.z-p.z)<10));
     m.target=far;m.until=now+9000}
   }else{
    p.x=p.id%2?-.7:.7;p.z=entry.z-1;p.noiseUntil=0;send(p.socket,{type:'caught',x:p.x,z:p.z});send(p.socket,{type:'killed'});
    broadcast({type:'move',...publicPlayer(p)},p.socket);m.target=null;m.until=0;respot(session)}
   break}
  inInstance(id,{type:'monster',x:m.x,z:m.z,rotation:m.rotation,chasing:!!m.target,sleeping:false});
 }
},100);
globalThis.__dbg=process.env.DBG==='1';
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Server ready'));
