export const GRID=11, CELL=4, MAZE_LIMIT=21.6, ENTRY={x:0,z:20}, HAMMER={x:-20,z:-20}, CROWBAR={x:20,z:-20}, DOOR={x:0,z:-2};
export function layout(){
 const n=GRID,dirs=[[0,-1],[1,0],[0,1],[-1,0]],cells=Array.from({length:n*n},()=>({seen:false,open:[false,false,false,false]}));let seed=49371;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const center=Math.floor(n*n/2),stack=[n*n-1];cells[stack[0]].seen=true;
 while(stack.length){const i=stack[stack.length-1],x=i%n,z=Math.floor(i/n),options=[];for(let d=0;d<4;d++){const nx=x+dirs[d][0],nz=z+dirs[d][1],j=nz*n+nx;if(nx<0||nx>=n||nz<0||nz>=n||cells[j].seen)continue;if((i===center&&j===center-n)||(i===center-n&&j===center))continue;options.push([d,j])}if(!options.length){stack.pop();continue}const [d,j]=options[Math.floor(rand()*options.length)];cells[i].open[d]=true;cells[j].open[(d+2)%4]=true;cells[j].seen=true;stack.push(j)}return cells;
}
