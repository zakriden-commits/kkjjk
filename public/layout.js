export const GRID=11, CELL=4, MAZE_LIMIT=21.6, ENTRY={x:0,z:20}, HAMMER={x:-20,z:-20}, CROWBAR={x:20,z:-20}, DOOR={x:0,z:-2};
export function layout(){
 const n=GRID,dirs=[[0,-1],[1,0],[0,1],[-1,0]],cells=Array.from({length:n*n},()=>({seen:false,open:[false,false,false,false]}));let seed=49371;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const center=Math.floor(n*n/2),stack=[n*n-1];cells[stack[0]].seen=true;
 while(stack.length){const i=stack[stack.length-1],x=i%n,z=Math.floor(i/n),options=[];for(let d=0;d<4;d++){const nx=x+dirs[d][0],nz=z+dirs[d][1],j=nz*n+nx;if(nx<0||nx>=n||nz<0||nz>=n||cells[j].seen)continue;if((i===center&&j===center-n)||(i===center-n&&j===center))continue;options.push([d,j])}if(!options.length){stack.pop();continue}const [d,j]=options[Math.floor(rand()*options.length)];cells[i].open[d]=true;cells[j].open[(d+2)%4]=true;cells[j].seen=true;stack.push(j)}return cells;
}
// Safe cells are shared by the renderer and monster pathfinding.
export function isSafeCell(i){const x=i%GRID,z=Math.floor(i/GRID),middle=(GRID-1)/2;return Math.abs(x-middle)<=1&&z>=GRID-2}
export function randomToolSpots(random=Math.random){
 const cells=layout(),half=(GRID-1)/2;
 const candidates=[];
 for(let i=0;i<cells.length;i++){const x=(i%GRID-half)*CELL,z=(Math.floor(i/GRID)-half)*CELL;if(isSafeCell(i)||Math.abs(x)+Math.abs(z)<10)continue;candidates.push(i)}
 function choose(exclude){const options=candidates.filter(i=>i!==exclude&&(exclude===null||Math.abs((i%GRID)-(exclude%GRID))+Math.abs(Math.floor(i/GRID)-Math.floor(exclude/GRID))>=4));const i=options[Math.floor(random()*options.length)];const x=(i%GRID-half)*CELL,z=(Math.floor(i/GRID)-half)*CELL,closed=cells[i].open.map((open,d)=>open?null:d).filter(d=>d!==null);const type=['floor','wall','ceiling'][Math.floor(random()*3)];if(type==='wall'&&closed.length){const dir=closed[Math.floor(random()*closed.length)],offset=[[0,-1.83],[1.83,0],[0,1.83],[-1.83,0]][dir];return {cell:i,x:x+offset[0],z:z+offset[1],type,dir}}return {cell:i,x,z,type:type==='wall'?'floor':type}}
 const hammer=choose(null),crowbar=choose(hammer.cell);return {hammer,crowbar};
}
