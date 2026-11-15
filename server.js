import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
const app=express();app.use('/vendor/three',express.static('node_modules/three/build'));app.use(express.static('public'));
const server=createServer(app),wss=new WebSocketServer({server}),players=new Map();let nextId=1,waiting=null;
let puzzle={hammer:false,crowbar:false,nails:false,boards:false,door:false};
function broadcast(data,except){const msg=JSON.stringify(data);for(const c of wss.clients)if(c!==except&&c.readyState===1)c.send(msg)}
function send(socket,data){if(socket?.readyState===1)socket.send(JSON.stringify(data))}
function startLift(ids){for(const id of ids){const p=players.get(id);if(p){p.status='lift';p.room='lift';send(p.socket,{type:'lift'})}}waiting=null;}
function publicPlayer(p){const {socket,status,...rest}=p;return rest}
wss.on('connection',socket=>{const id=nextId++;socket.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}
 if(m.type==='join'&&!players.has(id)){
  const a=Math.random()*Math.PI*2,p={id,socket,status:'playing',name:String(m.name||'Игрок').trim().slice(0,20)||'Игрок',skin:m.skin==='batman'?'batman':'joker',room:'main',x:Math.cos(a)*2,z:Math.sin(a)*2,rotation:0,y:0};players.set(id,p);
  send(socket,{type:'welcome',id,player:publicPlayer(p),players:[...players.values()].filter(p=>p.id!==id).map(publicPlayer),puzzle});broadcast({type:'join',player:publicPlayer(p)},socket);
 }else if(!players.has(id))return;
 else if(m.type==='fall'){
  const p=players.get(id);if(p.room!=='main'||p.status!=='playing')return;p.status='choosing';p.room='lift';broadcast({type:'move',id,x:p.x,z:p.z,rotation:p.rotation,room:'lift'},socket);
  if(waiting!==null&&waiting!==id&&players.has(waiting))startLift([waiting,id]);else send(socket,{type:'choice'});
 }else if(m.type==='lift-choice'){
  const p=players.get(id);if(p.status!=='choosing'&&p.status!=='waiting')return;
  if(m.choice==='solo'){if(waiting===id)waiting=null;startLift([id])}
  else if(m.choice==='together'){if(waiting!==null&&waiting!==id&&players.has(waiting))startLift([waiting,id]);else{waiting=id;p.status='waiting';send(socket,{type:'waiting'})}}
 }else if(m.type==='lift-arrived'){
  const p=players.get(id);if(p.status!=='lift')return;p.status='playing';p.room='basement';p.x=0;p.z=7.5;broadcast({type:'move',id,x:p.x,z:p.z,rotation:p.rotation,room:p.room},socket);
 }else if(m.type==='move'&&[m.x,m.z,m.rotation].every(Number.isFinite)){
  const p=players.get(id);if(p.status!=='playing')return;p.x=Math.max(-8.4,Math.min(8.4,m.x));p.z=Math.max(-8.4,Math.min(8.4,m.z));p.rotation=m.rotation;p.y=Number.isFinite(m.y)?Math.max(0,Math.min(1.5,m.y)):0;broadcast({type:'move',id,x:p.x,z:p.z,y:p.y,rotation:p.rotation,room:p.room},socket);
 }else if(m.type==='interact'){
  const p=players.get(id);if(p.status!=='playing'||p.room!=='basement')return;
  const near=(x,z)=>Math.hypot(p.x-x,p.z-z)<1.8;let result='';
  if(m.target==='hammer'&&near(-7,-6)&&!puzzle.hammer){puzzle.hammer=true;result='Молоток найден!'}
  else if(m.target==='crowbar'&&near(7,-6)&&!puzzle.crowbar){puzzle.crowbar=true;result='Гвоздодёр найден!'}
  else if(m.target==='door'&&near(0,0)){
   if(!puzzle.nails){if(puzzle.crowbar){puzzle.nails=true;result='Четыре гвоздя вытащены гвоздодёром.'}else result='Нужен гвоздодёр, чтобы вытащить четыре гвоздя.'}
   else if(!puzzle.boards){if(puzzle.hammer){puzzle.boards=true;result='Доски сняты молотком.'}else result='Найди молоток, чтобы снять доски.'}
   else if(!puzzle.door){puzzle.door=true;result='Дверь открыта! Продолжение следует.'}else result='Дверь открыта. Продолжение следует.';
  }
  if(result){broadcast({type:'puzzle',puzzle});send(socket,{type:'message',text:result})}
 }
 });socket.on('close',()=>{if(waiting===id)waiting=null;if(players.delete(id)){broadcast({type:'leave',id});if(!players.size)puzzle={hammer:false,crowbar:false,nails:false,boards:false,door:false}}});});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Server ready'));
