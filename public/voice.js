// Voice chat over the game socket.
// Mobile networks (especially on the phone) very often block peer to peer audio, so the
// microphone is streamed as small PCM frames and the server relays them to the friend.
const RATE=16000,FRAME=640; // 16 kHz mono, 40 ms frames

export function createVoice(send,notify,sendBinary){
 const button=document.querySelector('#mic'),toggle=document.querySelector('#voice-enabled'),lobbyButton=document.querySelector('#voice-btn');
 let stream=null,ctx=null,source=null,processor=null,sink=null;
 let enabled=false,talking=false,peers=0,nextPlay=0,carry=0,queue=[];

 function ui(){
  if(!button)return;
  button.hidden=!enabled;
  button.textContent=talking?'🎙 Говорю':'🎙 Вкл';
  button.classList.toggle('active',!!(enabled&&talking));
  if(lobbyButton)lobbyButton.textContent=enabled?(talking?'🎙 Голос вкл':'🎙 Голос выкл'):'🎙 Голос';
 }
 function report(text){if(notify)notify(text)}

 async function enable(){
  if(enabled)return true;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('no-media');
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
   ctx=new (window.AudioContext||window.webkitAudioContext)();
   await ctx.resume();
   if(ctx.state!=='running'){await ctx.resume().catch(()=>{})}
   source=ctx.createMediaStreamSource(stream);
   processor=ctx.createScriptProcessor(1024,1,1);
   sink=ctx.createGain();sink.gain.value=0;
   source.connect(processor);processor.connect(sink);sink.connect(ctx.destination);
   processor.onaudioprocess=capture;
   enabled=true;talking=true;carry=0;queue=[];ui();
   if(toggle)toggle.checked=true;
   send({type:'voice-ready',enabled:true});
   report('Микрофон включён. Говори — друг услышит.');
   return true;
  }catch(error){
   stop();
   report(error?.name==='NotAllowedError'
    ?'Браузер не дал доступ к микрофону. Разреши его в настройках сайта и попробуй снова.'
    :'Не удалось включить микрофон. Проверь, что сайт открыт по https и микрофон разрешён.');
   return false;
  }
 }
 function stop(){
  enabled=false;talking=false;carry=0;queue=[];
  processor&&(processor.onaudioprocess=null);
  try{source?.disconnect();processor?.disconnect();sink?.disconnect()}catch{}
  source=processor=sink=null;
  stream?.getTracks().forEach(track=>track.stop());stream=null;
  if(ctx){ctx.close().catch(()=>{});ctx=null}
  nextPlay=0;queue=[];
  if(toggle)toggle.checked=false;
  ui();
  try{send({type:'voice-ready',enabled:false})}catch{}
 }
 function toggleTalk(){
  if(!enabled)return enable();
  talking=!talking;ui();
  if(talking)report('Говори — микрофон включён.');
 }
 lobbyButton?.addEventListener('click',event=>{event.preventDefault();if(!enabled)enable();else{talking=!talking;ui()}});
 button?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleTalk()});
 toggle?.addEventListener('change',()=>{if(toggle.checked)enable();else stop()});

 // ---- capture: float input -> 16 kHz int16 frames
 function capture(event){
  if(!talking||!sendBinary)return;
  const input=event.inputBuffer.getChannelData(0),ratio=ctx.sampleRate/RATE;
  let index=carry;
  while(index<input.length){
   const i=Math.floor(index),f=index-i,a=input[i]??0,b=input[i+1]??a;
   queue.push(a+(b-a)*f);
   index+=ratio;
  }
  carry=index-input.length;
  while(queue.length>=FRAME){
   const chunk=queue.splice(0,FRAME),bytes=new Int16Array(FRAME);
   for(let i=0;i<FRAME;i++){const v=Math.max(-1,Math.min(1,chunk[i]));bytes[i]=v<0?v*32768:v*32767}
   sendBinary(bytes.buffer);
  }
  if(queue.length>RATE*2)queue=[];
 }

 // ---- playback: int16 frames -> scheduled audio buffers
 function play(data){
  if(!enabled||!ctx)return;
  const bytes=new Int16Array(data);
  if(!bytes.length)return;
  if(nextPlay&&nextPlay<ctx.currentTime-.25)nextPlay=0
  const samples=new Float32Array(bytes.length);
  for(let i=0;i<bytes.length;i++)samples[i]=bytes[i]/32768;
  const buffer=ctx.createBuffer(1,samples.length,RATE);
  buffer.copyToChannel(samples,0);
  const node=ctx.createBufferSource();node.buffer=buffer;node.connect(ctx.destination);
  const start=Math.max(ctx.currentTime+.09,nextPlay||0);
  node.start(start);
  nextPlay=start+buffer.duration;
  node.onended=()=>{try{node.disconnect()}catch{}}
 }
 function setPeers(list){
  peers=Array.isArray(list)?list.length:Number(list)||0;
  if(enabled&&peers===0)report('Микрофон включён, но друг пока не включил свой.');
 }
 return {
  enable,stop,play,setPeers,
  toggle:toggleTalk,
  setId(id){if(enabled)send({type:'voice-ready',enabled:true})},
  get enabled(){return enabled},
  get talking(){return talking},
  get peers(){return peers},
  sync(list){setPeers(list)},
  onSignal(){}
 };
}
