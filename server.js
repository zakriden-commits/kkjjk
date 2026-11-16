import express from 'express';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { GRID, layout, MAZE_LIMIT, ENTRY, randomToolSpots, isSafeCell } from './public/layout.js';
const app=express(),BUILD=(process.env.RENDER_GIT_COMMIT||process.env.GIT_COMMIT||'local').slice(0,7);
const indexHtml=readFileSync('public/index.html','utf8');
app.get('/',(req,res)=>{res.set('Cache-Control','no-store');res.type('html').send(indexHtml.replace('/game.js',`/game.js?v=${BUILD}`).replace('/style.css',`/style.css?v=${BUILD}`))});
app.get('/api/version',(req,res)=>{res.set('Cache-Control','no-store');res.json({build:BUILD})});
function cacheHeaders(res,path){if(path.endsWith('.html'))res.setHeader('Cache-Control','no-store');else if(path.endsWith('.js')||path.endsWith('.css'))res.setHeader('Cache-Control','no-cache');else res.setHeader('Cache-Control','public, max-age=86400')}
app.use('/vendor/three/addons',express.static('node_modules/three/examples/jsm',{setHeaders:cacheHeaders}));app.use('/vendor/three',express.static('node_modules/three/build',{setHeaders:cacheHeaders}));app.use(express.static('public',{setHeaders:cacheHeaders}));
let lastVisit=null;app.get('/api/history',(req,res)=>res.json({lastVisit}));
const server=createServer(app),wss=new WebSocketServer({server}),players=new Map(),instances=new Map();let nextId=1,nextInstance=1,waiting=null;
const freshPuzzle=()=>({hammer:false,crowbar:false,nails:false,boards:false,door:false});
const send=(socket,data)=>{if(socket?.readyState===1)socket.send(JSON.stringify(data))};
function broadcast(data,except){for(const c of wss.clients)if(c!==except)send(c,data)}
function inInstance(id,data,except){for(const p of players.values())if(p.instance===id&&p.socket!==except)send(p.socket,data)}
function publicPlayer(p){const {socket,status,choiceTimer,noiseUntil,noiseLoudUntil,...rest}=p;return rest}
function startLift(ids){const instance=nextInstance++;instances.set(instance,{puzzle:freshPuzzle(),spots:randomToolSpots(),monster:{x:0,z:-12,rotation:0,target:null,until:0,patrol:null}});for(const id of ids){const p=players.get(id);if(p){clearTimeout(p.choiceTimer);p.status='lift';p.room='lift';p.instance=instance;send(p.socket,{type:'lift',together:ids.length>1,instance,puzzle:instances.get(instance).puzzle,spots:instances.get(instance).spots});broadcast({type:'move',...publicPlayer(p)},p.socket)}}if(ids.includes(waiting))waiting=null;}
function sameVoice(a,b){return a&&b&&a.id!==b.id&&((a.room==='main'&&b.room==='main')||(a.instance!==null&&a.instance===b.instance))}
function voicePeers(p){return [...players.values()].filter(q=>q.voice&&sameVoice(p,q)).map(q=>q.id)}
function refreshVoice(){for(const p of players.values())if(p.voice)send(p.socket,{type:'voice-peers',peers:voicePeers(p)})}
wss.on('connection',(socket,request)=>{socket.upgradeReqAgent=request.headers['user-agent']||'';const id=nextId++;socket.on('message',raw=>{if(raw.length>16000)return;let m;try{m=JSON.parse(raw.toString())}catch{return}if(!m||typeof m!=='object')return;
 if(m.type==='join'&&!players.has(id)){
  const a=Math.random()*Math.PI*2,p={id,socket,status:'playing',name:String(m.name||'Игрок').trim().slice(0,20)||'Игрок',skin:m.skin==='batman'?'batman':'joker',room:'main',instance:null,x:Math.cos(a)*2,z:Math.sin(a)*2,rotation:0,y:0,equipped:null,voice:false,noiseUntil:0};players.set(id,p);const ua=String(socket.upgradeReqAgent||'');lastVisit={device:/iPhone|iPad/i.test(ua)?'iPhone / iPad':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh/i.test(ua)?'Mac':'другое устройство',time:new Date().toISOString()};
  send(socket,{type:'welcome',id,player:publicPlayer(p),players:[...players.values()].filter(p=>p.id!==id).map(publicPlayer),puzzle:freshPuzzle()});broadcast({type:'join',player:publicPlayer(p)},socket);
 }else if(!players.has(id))return;
 else if(m.type==='fall'){
  const p=players.get(id);if(p.room!=='main'||p.status!=='playing')return;p.status='choosing';p.room='lift';broadcast({type:'move',...publicPlayer(p)},socket);refreshVoice();
  if(waiting!==null&&waiting!==id&&players.has(waiting)){startLift([waiting,id]);refreshVoice()}else {send(socket,{type:'choice',seconds:15});p.choiceTimer=setTimeout(()=>{if(players.has(id)&&p.status==='choosing'){startLift([id]);refreshVoice()}},15000)}
 }else if(m.type==='lift-choice'){
  const p=players.get(id);if(p.status!=='choosing'&&p.status!=='waiting')return;
  if(m.choice==='solo'){if(waiting===id)waiting=null;startLift([id]);refreshVoice()}
  else if(m.choice==='together'){clearTimeout(p.choiceTimer);if(waiting!==null&&waiting!==id&&players.has(waiting)){startLift([waiting,id]);refreshVoice()}else{waiting=id;p.status='waiting';send(socket,{type:'waiting'})}}
 }else if(m.type==='lift-arrived'){
  const p=players.get(id);if(p.status!=='lift')return;p.status='playing';p.room='basement';p.x=id%2?-.55:.55;p.z=ENTRY.z;broadcast({type:'move',...publicPlayer(p)},socket);
 }else if(m.type==='move'&&[m.x,m.z,m.rotation].every(Number.isFinite)){
  const p=players.get(id);if(p.status!=='playing')return;const limit=p.room==='basement'?MAZE_LIMIT:8.4,oldX=p.x,oldZ=p.z;p.x=Math.max(-limit,Math.min(limit,m.x));p.z=Math.max(-limit,Math.min(limit,m.z));p.rotation=m.rotation;p.y=Number.isFinite(m.y)?Math.max(0,Math.min(1.5,m.y)):0;p.running=!!m.running;if(Math.hypot(p.x-oldX,p.z-oldZ)>.015)p.noiseUntil=Date.now()+350;broadcast({type:'move',...publicPlayer(p)},socket);
 }else if(m.type==='equip'){
  const p=players.get(id),session=instances.get(p.instance);if(!session||p.room!=='basement')return;const item=m.item==='hammer'||m.item==='crowbar'?m.item:null;if(item&&!session.puzzle[item])return;p.equipped=item;broadcast({type:'equip',id,item,instance:p.instance},socket);
 }else if(m.type==='interact'){
  const p=players.get(id),session=instances.get(p.instance);if(p.status!=='playing'||p.room!=='basement'||!session)return;const puzzle=session.puzzle;
  const near=(x,z)=>Math.hypot(p.x-x,p.z-z)<1.8;let result='',used=null,enterVoid=false;
  if(m.target==='hammer'&&near(session.spots.hammer.x,session.spots.hammer.z)&&!puzzle.hammer){puzzle.hammer=true;result='Молоток найден!'}
  else if(m.target==='crowbar'&&near(session.spots.crowbar.x,session.spots.crowbar.z)&&!puzzle.crowbar){puzzle.crowbar=true;result='Гвоздодёр найден!'}
  else if(m.target==='door'&&near(0,-1)){
   if(!puzzle.nails){if(puzzle.crowbar&&p.equipped==='crowbar'){puzzle.nails=true;result='Гвозди вытащены.';used='crowbar'}else result='Возьми гвоздодёр и выбери его в инвентаре.'}
   else if(!puzzle.boards){if(puzzle.hammer&&p.equipped==='hammer'){puzzle.boards=true;result='Доски сняты.';used='hammer'}else result='Возьми молоток и выбери его в инвентаре.'}
   else if(!puzzle.door){puzzle.door=true;result='Дверь открыта.';used='door';enterVoid=true}else {p.room='void';p.x=0;p.z=0;send(socket,{type:'enter-void'});broadcast({type:'move',...publicPlayer(p)},socket)}
  }
  if(result){inInstance(p.instance,{type:'puzzle',puzzle});send(socket,{type:'message',text:result});if(used){p.noiseUntil=Date.now()+5000;p.noiseLoudUntil=Date.now()+5000;inInstance(p.instance,{type:'use-tool',id,item:used})}if(enterVoid){p.room='void';p.x=0;p.z=0;send(socket,{type:'enter-void'});broadcast({type:'move',...publicPlayer(p)},socket)}}
 }else if(m.type==='voice-ready'){
  const p=players.get(id);p.voice=!!m.enabled;refreshVoice();
 }else if(m.type==='voice-signal'){
  const p=players.get(id),peer=players.get(m.to);if(p.voice&&peer?.voice&&sameVoice(p,peer)&&m.data&&typeof m.data==='object')send(peer.socket,{type:'voice-signal',from:id,data:m.data});
 }
 });socket.on('close',()=>{const p=players.get(id);if(waiting===id)waiting=null;clearTimeout(p?.choiceTimer);if(players.delete(id)){broadcast({type:'leave',id});if(p&&p.instance!==null&&![...players.values()].some(q=>q.instance===p.instance))instances.delete(p.instance);refreshVoice()}});});
// Server-authoritative hearing and maze-aware movement. The lift cell is a safe zone.
const cells=layout(),n=GRID,dirs=[[0,-1],[1,0],[0,1],[-1,0]],half=(n-1)/2;
function cellAt(x,z){return Math.max(0,Math.min(n-1,Math.round(x/4+half)))+n*Math.max(0,Math.min(n-1,Math.round(z/4+half)))}
function center(i){return {x:(i%n-half)*4,z:(Math.floor(i/n)-half)*4}}
function nextStep(start,end){if(start===end)return end;const queue=[start],prev=new Map([[start,-1]]);for(let k=0;k<queue.length;k++){const i=queue[k],x=i%n,z=Math.floor(i/n);for(let d=0;d<4;d++)if(cells[i].open[d]){const j=(z+dirs[d][1])*n+x+dirs[d][0];if(!prev.has(j)&&!isSafeCell(j)){prev.set(j,i);if(j===end){let cur=j;while(prev.get(cur)!==start&&prev.get(cur)!==-1)cur=prev.get(cur);return cur}queue.push(j)}}}return null}
setInterval(()=>{const now=Date.now();for(const [id,session] of instances){const m=session.monster,targets=[...players.values()].filter(p=>p.instance===id&&p.room==='basement'&&p.status==='playing'&&!isSafeCell(cellAt(p.x,p.z)));if(!targets.length)continue;
 let heard=null,best=Infinity;for(const p of targets){const dist=Math.hypot(p.x-m.x,p.z-m.z),range=p.noiseLoudUntil>now?14:p.noiseUntil>now?(p.running?12:6):2.3;if(dist<range&&dist<best){best=dist;heard=p}}
 if(heard){m.target={x:heard.x,z:heard.z};m.until=now+4500}if(now>m.until)m.target=null;
 if(!m.target&&(!m.patrol||Math.hypot(m.x-m.patrol.x,m.z-m.patrol.z)<.5)){let i;do{i=Math.floor(Math.random()*(n*n))}while(isSafeCell(i));m.patrol=center(i)}const dest=m.target||m.patrol;if(!m.waypoint||Math.hypot(m.x-m.waypoint.x,m.z-m.waypoint.z)<.06){const start=cellAt(m.x,m.z),end=cellAt(dest.x,dest.z),step=nextStep(start,end);if(step===null){m.target=null;m.patrol=null;m.waypoint=center(start)}else m.waypoint=step===start?{...dest}:center(step);if(isSafeCell(cellAt(m.waypoint.x,m.waypoint.z)))m.waypoint=center(start)}const point=m.waypoint;let dx=point.x-m.x,dz=point.z-m.z,dist=Math.hypot(dx,dz);if(dist>.05){const speed=m.target?4.3:1.7,amount=Math.min(dist,speed*.1);m.x+=dx/dist*amount;m.z+=dz/dist*amount;m.rotation=Math.atan2(-dx,-dz)}
 for(const p of targets)if(Math.hypot(p.x-m.x,p.z-m.z)<.8){p.x=p.id%2?-.55:.55;p.z=ENTRY.z;p.noiseUntil=0;send(p.socket,{type:'caught',x:p.x,z:p.z});broadcast({type:'move',...publicPlayer(p)},p.socket);m.target=null;m.until=0;break}
 inInstance(id,{type:'monster',x:m.x,z:m.z,rotation:m.rotation,chasing:!!m.target});
}},100);
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Server ready'));
