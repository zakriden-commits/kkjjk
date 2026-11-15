import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
const app=express();app.use('/vendor/three',express.static('node_modules/three/build'));app.use(express.static('public'));
const server=createServer(app),wss=new WebSocketServer({server}),players=new Map();let nextId=1;
function broadcast(data,except){const msg=JSON.stringify(data);for(const c of wss.clients)if(c!==except&&c.readyState===1)c.send(msg)}
wss.on('connection',socket=>{const id=nextId++;socket.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}if(m.type==='join'&&!players.has(id)){const a=Math.random()*Math.PI*2,p={id,name:String(m.name||'Игрок').trim().slice(0,20)||'Игрок',x:Math.cos(a)*2,z:Math.sin(a)*2,rotation:0};players.set(id,p);socket.send(JSON.stringify({type:'welcome',id,player:p,players:[...players.values()].filter(p=>p.id!==id)}));broadcast({type:'join',player:p},socket)}else if(m.type==='move'&&players.has(id)&&[m.x,m.z,m.rotation].every(Number.isFinite)){const p=players.get(id);p.x=Math.max(-8.4,Math.min(8.4,m.x));p.z=Math.max(-8.4,Math.min(8.4,m.z));p.rotation=m.rotation;broadcast({type:'move',id,x:p.x,z:p.z,rotation:p.rotation},socket)}});socket.on('close',()=>{if(players.delete(id))broadcast({type:'leave',id})})});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Server ready'));
