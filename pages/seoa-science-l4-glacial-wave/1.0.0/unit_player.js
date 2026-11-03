'use strict';
const UNIT=window.UNIT_DATA, CH=UNIT.chapters, $=id=>document.getElementById(id);
let active=0, frame=null, loaded=false, wanted=false, localT=0, pendingT=0, revision=0, first=true, cancelMetadata=()=>{};
const total=CH.reduce((sum,c)=>{c.t=sum;return sum+c.duration;},0);
const fmt=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const emit=m=>{if(parent!==window)parent.postMessage({...m,scope:'unit',unit:UNIT.id,version:UNIT.version},'*');};
const child=()=>loaded?frame?.contentWindow.LESSON:null;
const clean=text=>(text||'').replace(/\[([^\]]+)\]\([\w-]+\)/g,'$1');
function draw(){
 const c=CH[active], api=child();if(api)localT=api.time;
 $('chapterTitle').textContent=c.title_en;
 $('clock').textContent=`${fmt(c.t+localT)} / ${fmt(total)}`;
 $('pp').textContent=wanted?'Pause':'Play';$('pp').setAttribute('aria-label',wanted?'Pause':'Play');
 $('prev').disabled=active===0;$('next').disabled=active===CH.length-1;
 const shot=c.shots?.find(s=>localT>=s.t0&&localT<s.t1);
 $('caption').replaceChildren(document.createTextNode(clean(shot?.text||'')),$('ko')); 
 $('ko').textContent=shot?.ko||c.title_ko||'';
 CH.forEach((c,i)=>{const b=$('progress').children[i];b.setAttribute('aria-current',String(i===active));b.firstChild.style.width=`${Math.max(0,Math.min(1,(CH[active].t+localT-c.t)/c.duration))*100}%`;});
}
async function start(){
 wanted=true;draw();const api=child(), token=revision;if(!api)return;
 try{await api.resume();if(token!==revision||!wanted)api.pause();}
 catch(e){if(token!==revision)return;wanted=false;$('status').textContent='Audio could not start. Tap Play to retry.';draw();emit({type:'lesson:error',message:'audio-playback-blocked'});throw e;}
}
function pause(){wanted=false;child()?.pause();draw();}
function goto(i,t=0,autoplay=wanted){
 if(!Number.isInteger(i)||i<0||i>=CH.length)return;
 child()?.pause();cancelMetadata();revision++;loaded=false;active=i;wanted=autoplay;localT=pendingT=Math.max(0,Math.min(CH[i].duration,t));
 const next=document.createElement('iframe');next.title=CH[i].title_en;next.allow='autoplay';next.src=CH[i].src+'?embed=1';
 frame=next;$('stage').replaceChildren(next);$('status').textContent='Loading chapter…';draw();
 emit({type:'lesson:chapter',i:active,id:CH[i].id,title:CH[i].title_en});
}
function seek(t){
 if(!Number.isFinite(t))return;t=Math.max(0,Math.min(total,t));
 const i=Math.max(0,CH.findLastIndex(c=>t>=c.t));
 if(i!==active){goto(i,t-CH[i].t);return;}
 localT=pendingT=t-CH[i].t;child()?.seek(localT);draw();
 emit({type:'lesson:time',t:CH[i].t+localT,chapterT:localT,i});
}
function replay(){goto(active,0,true);}
window.LESSON={play:start,resume:start,pause,seek,goto:i=>goto(i),replay,get time(){return CH[active].t+(child()?.time??localT);},duration:total,chapters:CH,get chapter(){return active;},get paused(){return !wanted;}};
let resolveReady;window.ready=new Promise(r=>{resolveReady=r;});
window.addEventListener('message',e=>{
 const m=e.data;if(!m||typeof m!=='object')return;
 if(frame&&e.source===frame.contentWindow){
  if(m.type==='lesson:ready'){
   // Board readiness does not imply media metadata readiness. Keep pendingT
   // authoritative until currentTime can safely be set, including while paused.
   const current=frame, token=revision, audio=current.contentDocument.getElementById('v');
   cancelMetadata();
   const finish=()=>{
    if(token!==revision||frame!==current)return;
    cancelMetadata();
    current.contentWindow.LESSON.seek(pendingT);loaded=true;
    $('status').textContent='';draw();
    if(first){first=false;resolveReady();emit({type:'lesson:ready',duration:total,chapters:CH.map(({id,title_en,duration,t})=>({id,title:title_en,duration,t}))});}
    emit({type:'lesson:chapter',i:active,id:CH[active].id,title:CH[active].title_en});
    if(wanted)start().catch(()=>{});
   };
   const failed=()=>{if(token!==revision)return;cancelMetadata();wanted=false;$('status').textContent='Chapter audio could not load. Use Replay to retry.';draw();emit({type:'lesson:error',message:'audio-load-failed'});};
   cancelMetadata=()=>{audio.removeEventListener('loadedmetadata',finish);audio.removeEventListener('error',failed);cancelMetadata=()=>{};};
   audio.addEventListener('loadedmetadata',finish,{once:true});
   audio.addEventListener('error',failed,{once:true});
   if(audio.error)failed();else if(audio.readyState>=1)finish();
  }
  if(m.type==='lesson:time'&&loaded){draw();emit({type:'lesson:time',t:CH[active].t+localT,chapterT:localT,i:active});}
  if(m.type==='lesson:ended'&&loaded){if(active<CH.length-1)goto(active+1,0,true);else{pause();$('status').textContent='Unit ended';emit({type:'lesson:ended',t:total});}}
  return;
 }
 if(e.source!==parent||parent===window)return;
 if(m.type==='lesson:seek')seek(m.t);
 if(m.type==='lesson:play'||m.type==='lesson:resume')start().catch(()=>{});
 if(m.type==='lesson:pause')pause();
 if(m.type==='lesson:goto')goto(m.i);
});
CH.forEach((c,i)=>{const b=document.createElement('button');b.style.setProperty('--weight',c.duration);b.title=c.title_en;b.setAttribute('aria-label',`Chapter ${i+1}: ${c.title_en}`);const fill=document.createElement('i'),label=document.createElement('span');label.textContent=i+1;b.append(fill,label);b.onclick=()=>goto(i);$('progress').append(b);});
$('unitTitle').textContent=UNIT.title;document.title=UNIT.title;
$('pp').onclick=()=>wanted?pause():start().catch(()=>{});
$('prev').onclick=()=>goto(active-1);$('next').onclick=()=>goto(active+1);$('replay').onclick=replay;
$('help').onclick=()=>{const show=$('help').getAttribute('aria-pressed')!=='true';$('help').setAttribute('aria-pressed',String(show));$('ko').style.display=show?'block':'none';draw();};
goto(0);
