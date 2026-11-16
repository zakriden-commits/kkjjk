export const CELL=4, GRID=13, COOP_GRID=17, MAZE_LIMIT=21.6;
// The maze is mirrored by the server and the browser, so it must stay deterministic.
export function gridFor(coop){return coop?COOP_GRID:GRID}
export function limitFor(n){return ((n-1)/2)*CELL}
export function entryFor(n){return {x:0,z:((n-1)/2)*CELL}}
export function layout(n=GRID){
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]],cells=Array.from({length:n*n},()=>({seen:false,open:[false,false,false,false]}));
 let seed=(49371+n*7919)>>>0;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const center=Math.floor(n*n/2),stack=[n*n-1];cells[stack[0]].seen=true;
 const link=(i,d)=>{const x=i%n,z=Math.floor(i/n),j=(z+dirs[d][1])*n+(x+dirs[d][0]);cells[i].open[d]=true;cells[j].open[(d+2)%4]=true;return j};
 while(stack.length){const i=stack[stack.length-1],x=i%n,z=Math.floor(i/n),options=[];
  for(let d=0;d<4;d++){const nx=x+dirs[d][0],nz=z+dirs[d][1],j=nz*n+nx;
   if(nx<0||nx>=n||nz<0||nz>=n||cells[j].seen)continue;
   if((i===center&&j===center-n)||(i===center-n&&j===center))continue;
   options.push([d,j])}
  if(!options.length){stack.pop();continue}
  const [d,j]=options[Math.floor(rand()*options.length)];cells[i].open[d]=true;cells[j].open[(d+2)%4]=true;cells[j].seen=true;stack.push(j)}
 // Rooms and extra passages: a maze that is only dead ends feels cheap.
 const rooms=n>=15?5:3;
 for(let r=0;r<rooms;r++){
  const ax=1+Math.floor(rand()*(n-3)),az=2+Math.floor(rand()*(n-4));
  if(Math.abs(ax-(n-1)/2)<2&&Math.abs(az-(n-1)/2)<2)continue;
  link(az*n+ax,1);link((az+1)*n+ax,1);link(az*n+ax,2);link(az*n+ax+1,2);
 }
 const extra=Math.floor(n*n*.09);
 for(let k=0;k<extra;k++){
  const i=Math.floor(rand()*n*n),x=i%n,z=Math.floor(i/n),d=Math.floor(rand()*4);
  const nx=x+dirs[d][0],nz=z+dirs[d][1];
  if(nx<0||nx>=n||nz<0||nz>=n)continue;
  const j=nz*n+nx;
  if((i===center&&j===center-n)||(i===center-n&&j===center))continue;
  link(i,d);
 }
 return cells;
}
export function cellCenter(n,i){const half=(n-1)/2;return {x:(i%n-half)*CELL,z:(Math.floor(i/n)-half)*CELL}}
export function doorFor(){return {x:0,z:-2}}
// A three-step square around the lift is the only safe ground.
export function isSafe(n,x,z){const e=entryFor(n);return Math.abs(x)<=1.6&&Math.abs(z-e.z)<=1.9}
export function randomSpots(n,names,random=Math.random){
 const cells=layout(n),half=(n-1)/2,entry=entryFor(n),center=Math.floor(n*n/2),limit=(n-1)/2;
 const candidates=[];
 for(let i=0;i<cells.length;i++){const {x,z}=cellCenter(n,i);if(i===center||isSafe(n,x,z)||Math.hypot(x-entry.x,z-entry.z)<12)continue;candidates.push(i)}
 const used=[];
 return names.map(name=>{
  const options=candidates.filter(i=>!used.includes(i)&&used.every(j=>Math.abs((i%n)-(j%n))+Math.abs(Math.floor(i/n)-Math.floor(j/n))>=3));
  const i=options[Math.floor(random()*options.length)]||candidates[0];
  used.push(i);
  const {x,z}=cellCenter(n,i),closed=cells[i].open.map((open,d)=>open?null:d).filter(d=>d!==null);
  const type=['floor','wall','ceiling'][Math.floor(random()*3)];
  if(type==='wall'&&closed.length){const dir=closed[Math.floor(random()*closed.length)],offset=[[0,-1.83],[1.83,0],[0,1.83],[-1.83,0]][dir];return {name,cell:i,x:x+offset[0],z:z+offset[1],type,dir}}
  return {name,cell:i,x,z,type:type==='wall'?'floor':type};
 });
}
export function cellAt(n,x,z){const half=(n-1)/2;return Math.max(0,Math.min(n-1,Math.round(x/CELL+half)))+n*Math.max(0,Math.min(n-1,Math.round(z/CELL+half)))}
