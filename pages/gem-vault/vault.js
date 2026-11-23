'use strict';
const $=id=>document.getElementById(id),goal=5,key='gem-vault.study-layer.v1';
const names={seoa:'서아',seoin:'서인'},lessons={seoa:'단어 시험 연습',seoin:'단어탐정'};
const narrow=matchMedia('(max-width:650px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const fresh=()=>({gems:4,rolls:[],shown:0,ledger:[],answered:false,clue:false});
function initial(){
 try{const d=JSON.parse(sessionStorage.getItem(key));if(d && Object.hasOwn(names,d.child)&&Object.keys(names).every(k=>{
  const s=d[k];return s&&Number.isInteger(s.gems)&&s.gems>=0&&s.gems<=goal&&Array.isArray(s.ledger)&&s.ledger.every(v=>Number.isInteger(v)&&v>=5&&v<=50)&&
  Array.isArray(s.rolls)&&[0,5].includes(s.rolls.length)&&s.rolls.every(v=>Number.isInteger(v)&&v>=1&&v<=10)&&Number.isInteger(s.shown)&&s.shown>=0&&s.shown<=s.rolls.length;
 }))return d;}catch{}
 return {child:'seoin',sound:true,seoa:fresh(),seoin:fresh()};
}
const data=initial(),current=()=>data[data.child],save=()=>{try{sessionStorage.setItem(key,JSON.stringify(data));}catch{}};
let opened=false,popup='',returnFocus=null,finished=false,charging=false,chargeStart=0,chargeFrame=0,revealTimer=0,toastTimer=0,audioContext;
const won=v=>v.toLocaleString('ko-KR')+'원',balance=()=>current().ledger.reduce((a,b)=>a+b,0);
const sum=()=>current().rolls.slice(0,current().shown).reduce((a,b)=>a+b,0);
const activeRoll=()=>current().rolls.length>0&&!finished,ready=()=>current().gems===goal||activeRoll();
const notify=text=>{$('announce').textContent=text;};
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2200);notify(text);}
function bop(el){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
function unlock(){
 if(!data.sound)return;
 try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}
}
function tone(hz,delay=0,length=.13,type='triangle'){
 if(!data.sound||!audioContext||audioContext.state!=='running')return;
 const t=audioContext.currentTime+delay,osc=audioContext.createOscillator(),gain=audioContext.createGain();
 osc.type=type;osc.frequency.setValueAtTime(hz,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.065,t+.014);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
 osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+length+.01);
}
const canvas=$('fx'),ctx=canvas.getContext('2d'),particles=[];let frame=0,last=0;
function center(el){const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}
function fit(){const d=Math.min(2,devicePixelRatio||1);canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);}
addEventListener('resize',fit);fit();
const green=['#baffdc','#7df4bd','#66d9d4','#efffc1'],gold=['#ffeab3','#ffc35f','#fd9a67','#9ff4da','#fbf9da'];
function burst(el,colors,n,power=1){
  if(reduced.matches)return;
  const {x,y}=center(el);
  particles.push({x,y,life:.48,max:.48,r:6,type:'ring',color:colors[0],power});
  for(let i=0;i<n;i++){
    const angle=Math.random()*Math.PI*2,speed=(28+Math.random()*168)*power,life=.48+Math.random()*.66;
    particles.push({x,y,dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed-25,life,max:life,
      size:2+Math.random()*4,spin:Math.random()*6,color:colors[i%colors.length],type:i%5?'chip':'star'});
  }
  startFx();
}
function coinFlight(from,to,duration=.56,gem=false){
  if(reduced.matches)return;
  const a=center(from),b=center(to);particles.push({...a,a,b,type:'flight',gem,color:gem?'#50e4a6':'#ffcf68',life:duration,max:duration});startFx();
}
function startFx(){if(!frame){last=performance.now();frame=requestAnimationFrame(draw);}}
function draw(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;ctx.clearRect(0,0,innerWidth,innerHeight);
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
    const t=1-p.life/p.max;ctx.globalAlpha=Math.min(1,p.life*4);ctx.fillStyle=ctx.strokeStyle=p.color;
    if(p.type==='ring'){
      ctx.lineWidth=3*(1-t)+1;ctx.beginPath();ctx.ellipse(p.x,p.y,5+100*t*p.power,3+55*t*p.power,0,0,Math.PI*2);ctx.stroke();
    }else if(p.type==='flight'){
      const x=p.a.x+(p.b.x-p.a.x)*t,y=p.a.y+(p.b.y-p.a.y)*t-75*Math.sin(t*Math.PI);
      ctx.save();ctx.translate(x,y);if(p.gem)ctx.rotate(Math.PI/4);ctx.fillRect(-5,-6,10,12);ctx.fillStyle=p.gem?'#d5ffe5':'#fff4ab';ctx.fillRect(-3,-4,3,6);ctx.restore();
    }else{
      p.x+=p.dx*dt;p.y+=p.dy*dt;p.dy+=135*dt;ctx.save();ctx.translate(p.x|0,p.y|0);ctx.rotate(t*p.spin);
      ctx.fillRect(-p.size,-p.size*.35,p.size*2,p.size*.7);if(p.type==='star')ctx.fillRect(-p.size*.35,-p.size,p.size*.7,p.size*2);ctx.restore();
    }
  }
  ctx.globalAlpha=1;frame=particles.length?requestAnimationFrame(draw):0;
}
function hud(){
 const s=current(),chestReady=ready();
 $('gem').classList.toggle('available',chestReady);$('hudArt').src='assets/'+(chestReady?'chest':'gem')+'.png';
 $('gemText').textContent=activeRoll()?'이어서':chestReady?'상자 열기':s.gems+'/5';
 $('gem').setAttribute('aria-label',chestReady?'보석상자 열기':'모은 보석 '+s.gems+'개, 다섯 개 필요');
 $('balance').textContent=won(balance());$('wallet').setAttribute('aria-label','통장 잔액 '+won(balance())+' 내역 열기');
 $('lessonName').textContent=names[data.child]+' · '+lessons[data.child];$('lessonTitle').textContent=lessons[data.child];
 $('tip').textContent=opened?'상자를 접으면 같은 공부 화면으로 돌아가요.':chestReady?'목록 옆의 상자를 눌러 열어 보세요.':'공부 보상을 받으면 보석이 목록 옆으로 날아가요.';
 $('simulate').disabled=opened||chestReady;
 document.querySelectorAll('[data-child]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.child===data.child));b.disabled=opened;});
}
function lesson(){
 const s=current(),shot=(data.child==='seoin'&&s.clue?'clue':data.child)+'-'+(narrow.matches?'narrow':'wide');
 $('studyImage').src='assets/'+shot+'.webp';$('studyImage').alt=names[data.child]+'의 '+lessons[data.child]+' 예시 화면';
 $('zones').replaceChildren();
 for(const z of studyZones[shot]){
  const button=document.createElement('button');button.className='zone';button.ariaLabel=z.label;
  button.style.cssText='left:'+z.x*100+'%;top:'+z.y*100+'%;width:'+z.w*100+'%;height:'+z.h*100+'%;';
  button.onclick=()=>{
   if(opened)return;closePopup();unlock();
   if(z.act==='clue'||z.act==='scene'){s.clue=z.act==='clue';save();lesson();return;}
   if(z.act==='wrong'){toast('다른 단어를 골라 봐.');return;}
   if(s.answered){toast('이 문제의 체험 보석을 이미 받았어.');return;}
   if(!ready()){s.answered=true;earn(button);}else toast('모아 둔 보석상자를 먼저 열어 봐!');
  };$('zones').append(button);
 }
}
function choose(child){if(opened)return;closePopup();$('toast').hidden=true;finished=false;data.child=child;save();lesson();hud();}
document.querySelectorAll('[data-child]').forEach(b=>b.onclick=()=>choose(b.dataset.child));
narrow.addEventListener('change',lesson);
function earn(source){
 if(opened||ready())return;closePopup();unlock();finished=false;
 const s=current();s.gems++;save();hud();burst(source,green,20,.6);coinFlight(source,$('gem'),.52,true);bop($('gem'));tone(659);tone(988,.09);
 if(s.gems===goal){burst($('gem'),gold,43,.8);toast('보석 5개! 목록 옆에 상자가 나타났어.');[660,831,988].forEach((f,i)=>tone(f,.2+i*.09));}
 else toast('보석 +1 · '+s.gems+'/5');
}
$('simulate').onclick=()=>earn($('simulate'));
function closePopup(){popup='';$('popover').hidden=true;for(const id of ['menu','list','gem','wallet'])$(id).setAttribute('aria-expanded','false');}
function popText(text){const p=document.createElement('p');p.textContent=text;$('popBody').append(p);}
function row(text,click){const b=document.createElement('button');b.className='row';b.textContent=text;b.onclick=click;$('popBody').append(b);}
function showPopup(kind){
 if(opened)return;if(popup===kind){closePopup();return;}
 closePopup();popup=kind;$('toast').hidden=true;const box=$('popover'),s=current();
 box.hidden=false;box.classList.toggle('menu',kind==='menu');$(kind).setAttribute('aria-expanded','true');$('popBody').replaceChildren();
 $('popTitle').textContent={gem:'모은 보석',wallet:names[data.child]+'의 체험 통장',list:'공부 목록',menu:'전체 메뉴'}[kind];
 if(kind==='wallet'){
  popText('현재 잔액 '+won(balance()));
  if(!s.ledger.length)popText('상자를 열면 여기에 적립 내역이 생겨.');
  s.ledger.slice().reverse().forEach((v,i)=>{const li=document.createElement('div'),n=document.createElement('b');li.className='ledger';li.append('보석상자 '+(s.ledger.length-i)+'회');n.textContent='+'+won(v);li.append(n);$('popBody').append(li);});
 }else if(kind==='gem'){
  const m=document.createElement('div');m.className='meter';for(let i=0;i<goal;i++){const g=document.createElement('i');if(i<s.gems)g.className='on';m.append(g);}$('popBody').append(m);popText('보석 '+(goal-s.gems)+'개를 더 모으면 상자가 열려.');
 }else if(kind==='list'){row(lessons[data.child]+' · 공부로 돌아가기',closePopup);}
 else{
  row(ready()?'보석상자 열기':'모은 보석 '+s.gems+'/5',()=>ready()?openReward():showPopup('gem'));
  row('통장 내역 · '+won(balance()),()=>showPopup('wallet'));
  row(data.sound?'효과음 끄기':'효과음 켜기',()=>{data.sound=!data.sound;unlock();save();closePopup();showPopup('menu');});
 }
}
$('list').onclick=()=>showPopup('list');$('menu').onclick=()=>showPopup('menu');$('wallet').onclick=()=>showPopup('wallet');
$('gem').onclick=()=>ready()?openReward():showPopup('gem');$('popClose').onclick=()=>{const id=popup;closePopup();$(id)?.focus();};
document.addEventListener('pointerdown',e=>{if(popup&&!e.target.closest('.popover,.studybar'))closePopup();});
const cards=Array.from({length:5},(_,i)=>{const li=document.createElement('li');li.className='card';$('cards').append(li);return li;});
function phase(){return finished?'done':current().shown===5?'settling':activeRoll()?'reveal':charging?'charging':'ready';}
function reward(){
 const s=current(),p=phase(),done=p==='done',rolling=p==='reveal',settling=p==='settling';
 $('reward').className='reward '+p+(rolling&&s.shown===4?' lastCard':'');
 $('rewardTitle').textContent=done?'보상 획득!':rolling?'보상 공개':settling?'통장으로 이동 중':'보석상자';
 $('rewardHint').textContent=done?'다섯 장의 금액을 통장에 모았어.':rolling?(s.shown===4?'마지막 한 장… 얼마가 나올까?':(s.shown+1)+'번째 카드가 열릴 차례야.'):settling?'모은 금액이 잔액으로 날아가!':charging?'조금만 더…':'상자를 톡 누르거나 꾹 눌러 빛을 채워 봐!';
 $('chestArt').src='assets/'+(rolling||done||settling?'open':'chest')+'.png';
 $('chest').disabled=rolling||done||settling;
 $('line').textContent=done?'통장 적립 완료':s.rolls.length?'현재까지 모은 금액':'한 장에 1~10원 · 최대 50원';
 $('total').textContent=sum();$('historyAction').hidden=!done;
 $('rewardAction').textContent=done?'공부로 돌아가기':settling?'적립 중…':rolling?'카드 공개 중…':'한 번 눌러 열기';$('rewardAction').disabled=rolling||settling||charging;
 cards.forEach((li,i)=>{
  const shown=i<s.shown,v=s.rolls[i],style=shown?'revealed'+(v>=8?' rich':''):rolling?'mystery'+(i===s.shown?' next':''):'locked';
  if(li.dataset.style===style&&(!shown||li.dataset.value===String(v)))return;
  li.className='card '+style;li.dataset.style=style;li.dataset.value=shown?v:'';
  const n=document.createElement('b');n.textContent=shown?v:s.rolls.length?'?':'◇';
  if(shown){const unit=document.createElement('small');unit.textContent='원';n.append(unit);}li.replaceChildren(n);
  li.ariaLabel=(i+1)+'번째 카드 '+(shown?won(v):s.rolls.length?'물음표':'잠김');
 });
}
function gate(on){$('study').inert=on;document.querySelector('.studybar').inert=on;document.querySelector('.demo').inert=on;}
function openReward(){
 if(opened||!ready())return;returnFocus=document.activeElement;closePopup();unlock();$('toast').hidden=true;opened=true;finished=false;
 $('veil').hidden=false;gate(true);hud();reward();$('dismiss').focus({preventScroll:true});
 if(activeRoll())scheduleNext();else tone(392,0,.19);
}
function stopCharge(){
 cancelAnimationFrame(chargeFrame);charging=false;$('chargeFill').style.width='0%';$('reward').classList.remove('hot');
}
function closeReward(history=false){
 if(!opened)return;clearTimeout(revealTimer);stopCharge();
 if(finished){current().rolls=[];current().shown=0;save();}
 opened=false;finished=false;$('veil').hidden=true;gate(false);hud();
 (returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:$('gem')).focus({preventScroll:true});
 if(history){showPopup('wallet');$('wallet').focus();}
}
function beginCharge(){
 if(!opened||charging||activeRoll()||finished)return;
 charging=true;chargeStart=performance.now();unlock();reward();let beat=-1;
 function pump(now){
  if(!charging)return;const t=Math.min(1,(now-chargeStart)/1080),next=Math.floor(t*5);
  $('chargeFill').style.width=t*100+'%';$('reward').classList.toggle('hot',t>.62);
  if(next!==beat){beat=next;tone(185+next*58,0,.09);if(next>1)burst($('chest'),gold,5,.32);}
  if(t===1){stopCharge();openChest();}else chargeFrame=requestAnimationFrame(pump);
 }chargeFrame=requestAnimationFrame(pump);
}
function cancelHold(){if(charging){stopCharge();reward();}}
$('chest').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();$('chest').setPointerCapture(e.pointerId);beginCharge();};
$('chest').onpointerup=()=>{if(charging&&performance.now()-chargeStart>220)cancelHold();};$('chest').onpointercancel=cancelHold;
$('chest').onclick=e=>{if(e.detail===0)beginCharge();};
$('rewardAction').onclick=()=>finished?closeReward():beginCharge();
$('historyAction').onclick=()=>closeReward(true);$('dismiss').onclick=()=>closeReward();
function openChest(){
 const s=current();s.gems=0;s.rolls=Array.from({length:5},()=>1+Math.floor(Math.random()*10));s.shown=0;
 save();hud();reward();burst($('chest'),gold,82,1.35);
 cards.forEach((li,i)=>coinFlight($('chest'),li,.42+.08*i));[246,392,523,784].forEach((f,i)=>tone(f,.07*i,.2));scheduleNext();
}
function scheduleNext(){
 clearTimeout(revealTimer);if(!opened||!activeRoll())return;
 const s=current();
 if(s.shown===5){revealTimer=setTimeout(deposit,reduced.matches?100:640);return;}
 const wait=[850,720,840,1020,1630][s.shown];revealTimer=setTimeout(flip,reduced.matches?520:wait);
}
function flip(){
 if(!opened||!activeRoll())return;
 const s=current(),i=s.shown++;save();reward();burst(cards[i],gold,i===4?65:22,i===4?1.05:.65);
 tone([392,494,622,740,988][i],0,.23);notify((i+1)+'번째 카드 '+won(s.rolls[i]));
 if(i===3){tone(185,.25,.16);tone(220,.7,.15);tone(277,1.15,.16);}
 if(i===4)cards.forEach((el,i)=>coinFlight(el,$('wallet'),.38+.055*i));else coinFlight(cards[i],$('total'),.36);
 scheduleNext();
}
function deposit(){
 if(!opened||!activeRoll()||current().shown!==5)return;
 const s=current();s.ledger.push(sum());finished=true;
 // Persist the credit and clear its pending draw together; keep the faces for this view only.
 const faces=s.rolls;s.rolls=[];s.shown=0;save();s.rolls=faces;s.shown=5;
 hud();reward();bop($('wallet'));burst($('wallet'),gold,30,.75);[784,988,1175,1568].forEach((f,i)=>tone(f,.09*i,.25));notify('보석상자 '+won(sum())+' 적립 완료');
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(opened)closeReward();else closePopup();return;}
 if(opened&&e.key==='Tab'){
  const buttons=[...$('reward').querySelectorAll('button:not(:disabled):not([hidden])')];
  if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}
  else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}
 }
});
addEventListener('pagehide',()=>{clearTimeout(revealTimer);stopCharge();});
addEventListener('pageshow',e=>{if(e.persisted&&opened){reward();scheduleNext();}});
lesson();hud();
