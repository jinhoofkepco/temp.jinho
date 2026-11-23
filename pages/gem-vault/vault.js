'use strict';
const $=id=>document.getElementById(id),goal=5,key='gem-vault.study-layer.v1';
const standardChest={minDrops:3,maxDrops:5};
const maxSupportedDrops=10, maxWonPerDrop=10;
const names={seoa:'서아',seoin:'서인'},lessons={seoa:'단어 시험 연습',seoin:'단어탐정'};
const narrow=matchMedia('(max-width:650px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const fresh=()=>({gems:4,rolls:[],shown:0,ledger:[],answered:false,clue:false});
function initial(){
 try{const d=JSON.parse(sessionStorage.getItem(key));if(d && Object.hasOwn(names,d.child)&&Object.keys(names).every(k=>{
  const s=d[k];return s&&Number.isInteger(s.gems)&&s.gems>=0&&s.gems<=goal&&Array.isArray(s.ledger)&&s.ledger.every(v=>Number.isInteger(v)&&v>=standardChest.minDrops&&v<=maxSupportedDrops*maxWonPerDrop)&&
  Array.isArray(s.rolls)&&(s.rolls.length===0||(s.rolls.length>=standardChest.minDrops&&s.rolls.length<=maxSupportedDrops))&&s.rolls.every(v=>Number.isInteger(v)&&v>=1&&v<=maxWonPerDrop)&&Number.isInteger(s.shown)&&s.shown>=0&&s.shown<=s.rolls.length;
 }))return d;}catch{}
 return {child:'seoin',sound:true,seoa:fresh(),seoin:fresh()};
}
const data=initial(),current=()=>data[data.child],save=()=>{try{sessionStorage.setItem(key,JSON.stringify(data));}catch{}};
let opened=false,popup='',earning=null,charging=false,chargeTimer=0,revealTimer=0,toastTimer=0,audioContext;
const won=v=>v.toLocaleString('ko-KR')+'원',balance=()=>current().ledger.reduce((a,b)=>a+b,0);
const sum=()=>current().rolls.slice(0,current().shown).reduce((a,b)=>a+b,0);
const activeRoll=()=>current().rolls.length>0,ready=()=>current().gems===goal||activeRoll();
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
function coinFlight(from,to,duration=.56){
  if(reduced.matches)return;
  const a=center(from),b=center(to);particles.push({...a,a,b,type:'flight',color:'#ffcf68',life:duration,max:duration});startFx();
}
function startFx(){if(!frame){last=performance.now();frame=requestAnimationFrame(draw);}}
function draw(now){
  const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;ctx.clearRect(0,0,innerWidth,innerHeight);
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
    const t=1-p.life/p.max;ctx.globalAlpha=Math.min(1,p.life*4);ctx.fillStyle=ctx.strokeStyle=p.color;
    if(p.type==='ring'){
      ctx.lineWidth=3*(1-t)+1;ctx.beginPath();ctx.ellipse(p.x,p.y,5+100*t*p.power,3+55*t*p.power,0,0,Math.PI*2);ctx.stroke();
    }else if(p.type==='flight'){
      const x=p.a.x+(p.b.x-p.a.x)*t,y=p.a.y+(p.b.y-p.a.y)*t-75*Math.sin(t*Math.PI);
      ctx.save();ctx.translate(x,y);ctx.fillRect(-5,-6,10,12);ctx.fillStyle='#fff4ab';ctx.fillRect(-3,-4,3,6);ctx.restore();
    }else{
      p.x+=p.dx*dt;p.y+=p.dy*dt;p.dy+=135*dt;ctx.save();ctx.translate(p.x|0,p.y|0);ctx.rotate(t*p.spin);
      ctx.fillRect(-p.size,-p.size*.35,p.size*2,p.size*.7);if(p.type==='star')ctx.fillRect(-p.size*.35,-p.size,p.size*.7,p.size*2);ctx.restore();
    }
  }
  ctx.globalAlpha=1;frame=particles.length?requestAnimationFrame(draw):0;
}
function hud(){
 $('gem').setAttribute('aria-expanded',String(opened||popup==='gem'));
 const s=current(),gems=earning?s.gems-1:s.gems,chestReady=!earning&&ready();
 $('gem').classList.toggle('available',chestReady);$('hudArt').src='assets/'+(chestReady?'emerald-chest':'emerald')+'.webp';
 $('gemText').textContent=opened?'상자 접기':activeRoll()?'이어서':chestReady?'상자 열기':gems+'/5';
 $('gem').setAttribute('aria-label',opened?'보석상자 접기':chestReady?'보석상자 열기':'모은 보석 '+gems+'개, 다섯 개 필요');
 $('balance').textContent=won(balance());$('wallet').setAttribute('aria-label','통장 잔액 '+won(balance())+' 내역 열기');
 $('lessonName').textContent=names[data.child]+' · '+lessons[data.child];$('lessonTitle').textContent=lessons[data.child];
 $('tip').textContent=opened?(activeRoll()?'금액을 모두 모으면 통장에 적립돼요.':'가운데 상자를 눌러 열어 보세요.'):chestReady?'목록 옆의 상자를 눌러 열어 보세요.':'공부 보상을 받으면 보석이 목록 옆으로 날아가요.';
 $('simulate').disabled=Boolean(earning)||opened||chestReady;
 document.querySelectorAll('[data-child]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.child===data.child));});
}
function lesson(){
 const s=current(),shot=(data.child==='seoin'&&s.clue?'clue':data.child)+'-'+(narrow.matches?'narrow':'wide');
 $('studyImage').src='assets/'+shot+'.webp';$('studyImage').alt=names[data.child]+'의 '+lessons[data.child]+' 예시 화면';
 $('zones').replaceChildren();
 for(const z of studyZones[shot]){
  const button=document.createElement('button');button.className='zone';button.ariaLabel=z.label;
  button.style.cssText='left:'+z.x*100+'%;top:'+z.y*100+'%;width:'+z.w*100+'%;height:'+z.h*100+'%;';
  button.onclick=()=>{
   if(opened)closeReward();closePopup();unlock();
   if(z.act==='clue'||z.act==='scene'){s.clue=z.act==='clue';save();lesson();return;}
   if(z.act==='wrong'){toast('다른 단어를 골라 봐.');return;}
   if(s.answered){toast('이 문제의 체험 보석을 이미 받았어.');return;}
   if(earning)return;
   if(!ready()){s.answered=true;earn(button);}else toast('모아 둔 보석상자를 먼저 열어 봐!');
  };$('zones').append(button);
 }
}
function choose(child){if(opened)closeReward();cancelGem();closePopup();$('toast').hidden=true;data.child=child;save();lesson();hud();}
document.querySelectorAll('[data-child]').forEach(b=>b.onclick=()=>choose(b.dataset.child));
narrow.addEventListener('change',lesson);
function cancelGem(){
 if(!earning)return;
 earning.animation.cancel();earning.sprite.remove();earning=null;
}
function earn(source){
 if(earning||opened||ready())return;
 closePopup();unlock();
 const s=current();s.gems++;save();
 const at=center(source===$('simulate')?$('study'):source),target=center($('hudArt'));
 const sprite=document.createElement('span');sprite.className='flyingGem';sprite.ariaHidden='true';
 const art=document.createElement('img');art.src='assets/emerald.webp';art.alt='';
 sprite.append(art,'+1');document.body.append(sprite);
 sprite.style.left=(at.x-sprite.offsetWidth/2)+'px';sprite.style.top=(at.y-18)+'px';
 const dx=target.x-at.x,dy=target.y-at.y;
 const pose=(x,y,scale)=>'translate('+x+'px,'+y+'px) scale('+scale+')';
 const animation=sprite.animate(reduced.matches?[{opacity:1},{opacity:0}]:[
  {offset:0,opacity:0,transform:pose(0,4,.4)},
  {offset:.20,opacity:1,transform:pose(0,-44,1.14)},
  {offset:.57,opacity:1,transform:pose(0,-49,1)},
  {offset:.74,opacity:1,transform:pose(dx*.26,(dy-49)*.45-30,.9)},
  {offset:1,opacity:.3,transform:pose(dx,dy,.16)}
 ],{duration:reduced.matches?100:1500,easing:'linear',fill:'both'});
 earning={animation,sprite};hud();burst(sprite,green,18,.58);tone(659);
 animation.onfinish=()=>{
  if(earning?.animation!==animation)return;
  sprite.remove();earning=null;hud();bop($('gem'));burst($('hudArt'),s.gems===goal?gold:green,30,.58);
  tone(988);if(s.gems===goal){
   tone(1244,.10);notify('보석 다섯 개. 보석상자 열기');
   if(!popup)openReward();
  }
  else notify('보석 '+s.gems+'개');
 };
}
$('simulate').onclick=()=>earn($('simulate'));
function closePopup(){popup='';$('popover').hidden=true;for(const id of ['menu','list','gem','wallet'])$(id).setAttribute('aria-expanded','false');}
function popText(text){const p=document.createElement('p');p.textContent=text;$('popBody').append(p);}
function row(text,click){const b=document.createElement('button');b.className='row';b.textContent=text;b.onclick=click;$('popBody').append(b);}
function showPopup(kind){
 if(opened)closeReward();if(popup===kind){closePopup();return;}
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
  row($('gem').ariaLabel,()=>$('gem').click());
  row('통장 내역 · '+won(balance()),()=>showPopup('wallet'));
  row(data.sound?'효과음 끄기':'효과음 켜기',()=>{data.sound=!data.sound;unlock();save();closePopup();showPopup('menu');});
 }
}
$('list').onclick=()=>showPopup('list');$('menu').onclick=()=>showPopup('menu');$('wallet').onclick=()=>showPopup('wallet');
$('gem').onclick=()=>{if(earning)return;if(opened)closeReward();else if(ready())openReward();else showPopup('gem');};$('popClose').onclick=()=>{const id=popup;closePopup();$(id)?.focus();};
document.addEventListener('pointerdown',e=>{if(popup&&!e.target.closest('.popover,.studybar'))closePopup();});
const layer=$('lootLayer'),chest=$('chest'),drops=$('drops');
function arrangeDrops(){
 const items=[...drops.children];
 const half=layer.clientWidth/2;
 const widest=items.reduce((w,el)=>Math.max(w,el.offsetWidth),0);
 const visible=Math.min(items.length,standardChest.maxDrops);
 const stride=Math.min(widest+12,(half-6)/Math.max(.5,visible-.5));
 const scale=Math.min(1,(stride-2)/Math.max(1,widest));
 items.forEach((el,i)=>{
  el.style.setProperty('--shift',-(items.length-1-i)*stride+'px');
  el.style.setProperty('--scale',scale);
 });
}
addEventListener('resize',arrangeDrops);
function addDrop(value){
 const item=document.createElement('li'),face=document.createElement('b');
 item.className=value>=8?'drop rich':'drop';
 const coin=document.createElement('i');coin.className='coin';coin.ariaHidden='true';
 const unit=document.createElement('small');unit.textContent='원';
 face.append(coin,String(value),unit);item.append(face);drops.append(item);
 arrangeDrops();return item;
}
function paintChest(){
 layer.classList.toggle('rolling',activeRoll());
 layer.classList.toggle('charging',charging);
 layer.classList.remove('finalBeat');
 chest.disabled=activeRoll();
 $('chestArt').src='assets/'+(activeRoll()?'emerald-chest-open':'emerald-chest')+'.webp';
}
function openReward(){
 if(opened||earning||!ready())return;
 closePopup();unlock();$('toast').hidden=true;opened=true;layer.hidden=false;
 drops.replaceChildren();current().rolls.slice(0,current().shown).forEach(addDrop);
 paintChest();hud();
 if(activeRoll())scheduleNext();
 else {chest.focus({preventScroll:true});tone(392,0,.19);}
}
function closeReward(){
 if(!opened)return;
 if(document.activeElement===chest)$('gem').focus({preventScroll:true});
 clearTimeout(revealTimer);clearTimeout(chargeTimer);charging=false;
 opened=false;layer.hidden=true;drops.replaceChildren();hud();
}
function roll(low,high){return low+Math.floor(Math.random()*(high-low+1));}
function openChest(){
 if(!opened||activeRoll()||!charging)return;
 const s=current();charging=false;s.gems=0;
 const count=roll(standardChest.minDrops,standardChest.maxDrops);
 s.rolls=Array.from({length:count},()=>roll(1,maxWonPerDrop));s.shown=0;
 save();paintChest();hud();burst(chest,gold,78,1.24);
 [246,392,523,784].forEach((f,i)=>tone(f,i*.07,.20));scheduleNext();
}
chest.onclick=()=>{
 if(!opened||charging||activeRoll())return;
 charging=true;paintChest();unlock();burst(chest,green,16,.56);
 [185,233,311,466].forEach((f,i)=>tone(f,i*.17,.12));
 chargeTimer=setTimeout(openChest,reduced.matches?60:840);
};
function scheduleNext(){
 clearTimeout(revealTimer);
 if(!opened||!activeRoll())return;
 const s=current(),remaining=s.rolls.length-s.shown;
 layer.classList.toggle('finalBeat',remaining===1);
 if(remaining===1){tone(233,.20,.13);tone(311,.57,.16);}
 if(!remaining){
  revealTimer=setTimeout(collect,reduced.matches?200:900);return;
 }
 const delay=remaining===1?1160:s.shown===0?360:650;
 revealTimer=setTimeout(reveal,reduced.matches?300:delay);
}
function reveal(){
 const s=current(),value=s.rolls[s.shown];s.shown++;save();
 const item=addDrop(value),lastDrop=s.shown===s.rolls.length;
 burst(item,gold,lastDrop ? 52 : 22,lastDrop ? .83 : .55);
 if(!reduced.matches)$('chestArt').animate([{transform:'scale(1)'},{transform:'scale(1.06,.94)'},{transform:'scale(.98,1.04)'},{transform:'scale(1)'}],{duration:270});
 tone(392*2**((s.shown-1)/6),0,.21);if(value>=8)tone(1175,.08,.12);
 notify(s.shown+'번째 '+won(value));scheduleNext();
}
function collect(){
 const items=[...drops.children];
 items.forEach((el,i)=>{
  coinFlight(el,$('wallet'),.35+i*.045);
  if(!reduced.matches)el.animate([{opacity:1},{opacity:0}],{duration:230,fill:'forwards'});
 });
 revealTimer=setTimeout(deposit,reduced.matches?60:380+items.length*45);
}
function deposit(){
 const s=current();
 if(!opened||!activeRoll()||s.shown!==s.rolls.length)return;
 const credit=sum();s.ledger.push(credit);s.rolls=[];s.shown=0;save();
 closeReward();bop($('wallet'));burst($('wallet'),gold,30,.75);
 [784,988,1175].forEach((f,i)=>tone(f,i*.09,.22));toast('통장에 +'+won(credit));
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(opened)closeReward();else closePopup();}});
addEventListener('pagehide',()=>{cancelGem();closeReward();});
addEventListener('pageshow',e=>{if(e.persisted)hud();});
lesson();hud();
