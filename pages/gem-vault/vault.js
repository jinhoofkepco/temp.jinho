'use strict';
const $=id=>document.getElementById(id),goal=5,key='gem-vault.study-layer.v1';
const standardChest={minDrops:3,maxDrops:5};
const maxSupportedDrops=10, maxWonPerDrop=10;
const names={seoa:'서아',seoin:'서인'},lessons={seoa:'단어 시험 연습',seoin:'단어탐정'};
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const fresh=()=>({gems:0,rolls:[],shown:0,ledger:[],answered:false,clue:false});
function initial(){
 try{const d=JSON.parse(sessionStorage.getItem(key));if(d && Object.hasOwn(names,d.child)&&Object.keys(names).every(k=>{
  const s=d[k];return s&&Number.isInteger(s.gems)&&s.gems>=0&&s.gems<=goal&&Array.isArray(s.ledger)&&s.ledger.every(v=>Number.isInteger(v)&&v>=standardChest.minDrops&&v<=maxSupportedDrops*maxWonPerDrop)&&
  Array.isArray(s.rolls)&&(s.rolls.length===0||(s.rolls.length>=standardChest.minDrops&&s.rolls.length<=maxSupportedDrops))&&s.rolls.every(v=>Number.isInteger(v)&&v>=1&&v<=maxWonPerDrop)&&Number.isInteger(s.shown)&&s.shown>=0&&s.shown<=s.rolls.length;
 }))return d;}catch{}
 return {child:'seoin',sound:true,seoa:fresh(),seoin:fresh()};
}
const data=initial(),current=()=>data[data.child],save=()=>{try{sessionStorage.setItem(key,JSON.stringify(data));}catch{}};
const gemStyles={mint:['에메랄드','#42dfac'],sapphire:['사파이어','#59aaff'],ruby:['루비','#ff557d'],amethyst:['자수정','#bc7dff'],amber:['호박색','#ffbe54']};
const chestStyles={
 royal:{name:'별빛 왕관',accent:'#cf82ff',power:1.2},
 emerald:{name:'에메랄드',accent:'#55eec3',power:1},
 silver:{name:'은빛 초승달',accent:'#a2c6ff',power:.85},
 wood:{name:'나무',accent:'#f0ad62',power:.65}
};
if(!Object.hasOwn(gemStyles,data.gemStyle))data.gemStyle='mint';
if(!Object.hasOwn(chestStyles,data.chestStyle))data.chestStyle='emerald';
const gemSrc=()=> 'assets/glass-'+data.gemStyle+'.webp';
const chestSrc=(style,open=false)=>'assets/'+style+'-chest'+(open?'-open':'')+'.webp';
let showOpen=false;
function paintCollection(){
 document.documentElement.style.setProperty('--gem-color',gemStyles[data.gemStyle][1]);
 document.documentElement.style.setProperty('--chest-light',chestStyles[data.chestStyle].accent);
 for(const img of document.querySelectorAll('.brand img,#simulate img'))img.src=gemSrc();
 document.querySelectorAll('[data-stone]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stone===data.gemStyle)));
 for(const b of document.querySelectorAll('[data-box]')){
  b.setAttribute('aria-pressed',String(b.dataset.box===data.chestStyle));
  b.querySelector('img').src=chestSrc(b.dataset.box,showOpen);
 }
 if(opened)paintChest();
 hud();
}
function buildCollection(){
 for(const [key,[name,color]] of Object.entries(gemStyles)){
  const b=document.createElement('button'),img=new Image();img.src='assets/glass-'+key+'.webp';img.alt='';
  b.dataset.stone=key;b.title=name;b.style.setProperty('--swatch',color);
  const label=document.createElement('span');label.textContent=name;b.append(img,label);
  b.onclick=()=>{data.gemStyle=key;save();paintCollection();};$('gemPalette').append(b);
 }
 for(const [key,style] of Object.entries(chestStyles)){
  const b=document.createElement('button'),img=new Image();img.alt='';
  b.dataset.box=key;b.style.setProperty('--swatch',style.accent);
  const label=document.createElement('span');label.textContent=style.name;b.append(img,label);
  b.onclick=()=>{data.chestStyle=key;save();paintCollection();};$('chestCollection').append(b);
 }
 $('lidPreview').onclick=()=>{showOpen=!showOpen;$('lidPreview').setAttribute('aria-pressed',String(showOpen));paintCollection();};
 paintCollection();
}
let breaking=false,opened=false,popup='',earning=null,charging=false,chargeTimer=0,revealTimer=0,toastTimer=0,audioContext;
const won=v=>v.toLocaleString('ko-KR')+'원',balance=()=>current().ledger.reduce((a,b)=>a+b,Number($('sample').value)||0);
const balanceText=()=>$('sample').value==='offline'?'연결 확인':won(balance());
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
let pixelRatio=1;
function fit(){
 pixelRatio=Math.min(2,devicePixelRatio||1);
 canvas.width=Math.round(canvas.clientWidth*pixelRatio);canvas.height=Math.round(canvas.clientHeight*pixelRatio);
}
new ResizeObserver(fit).observe(canvas);fit();
const green=['#baffdc','#7df4bd','#66d9d4','#efffc1'],gold=['#ffd64b','#ffab30','#fa8243','#48e3c2','#fff3b4'];
// Five staggered shells keep the launch, afterglow and falling sparks distinct.
const shellSpeeds=[1.9,1.3,1.65,.82,.58];
function creditSpark(el,colors,count,power){
 if(reduced.matches)return;
 const {x,y}=center(el);
 particles.push({x,y,type:'ring',color:colors[0],life:.48,max:.48,power:power*.57});
 for(let i=0;i<count;i++){
  const angle=i/count*Math.PI*2,speed=(28+Math.random()*168)*power,life=.48+Math.random()*.66;
  particles.push({x,y,dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed-25,life,max:life,size:2+Math.random()*4,spin:Math.random()*6,
   color:colors[i%colors.length],type:i%5===0?'star':i%3===0?'prism':'spark'});
 }
 startFx();
}
function burst(el,colors,count,power=1){
  if(reduced.matches)return;
  const {x,y}=center(el);
  const spread=Math.min(1,innerWidth/520);
  for(const [wave,speed] of shellSpeeds.entries()){
    const delay=wave*.062,life=.55+wave*.07;
    if(wave%2===0)particles.push({x,y,delay,life,max:life,type:'ring',color:colors[wave%colors.length],power:power*(1.9-wave*.19)*spread});
    for(let i=0;i<count;i++){
      const a=(i+Math.random()*.72+wave*.39)/count*Math.PI*2;
      const velocity=(90+Math.random()*145)*speed*power*spread;
      const duration=.53+Math.random()*.35+wave*.06;
      particles.push({x,y,delay,dx:Math.cos(a)*velocity,dy:Math.sin(a)*velocity-32*power,life:duration,max:duration,
        size:(2+Math.random()*3.3)*(wave===2?1.55:1),spin:Math.random()*6,color:colors[(i+wave)%colors.length],
        type:wave===0?'comet':wave===2?'prism':wave===3?'star':'spark'});
    }
  }
  startFx();
}
function converge(el,color,duration){
  if(reduced.matches)return;
  const {x,y}=center(el),radius=Math.min(innerWidth*.38,200);
  for(let i=0;i<48;i++){
    const angle=i*2.39996;
    particles.push({x,y,type:'inward',color,angle,radius:radius*(.58+Math.random()*.42),life:duration,max:duration});
  }
  startFx();
}
function impact(el,color,strength){
  if(reduced.matches)return;
  const {x,y}=center(el),life=.82;
  particles.push({x,y,type:'flare',color,life,max:life,radius:Math.min(210,innerWidth*.4)*strength});
  startFx();
}
function coinFlight(from,to,duration=.56){
  if(reduced.matches)return;
  const a=center(from),b=center(to);particles.push({...a,a,b,type:'flight',color:'#ffcf68',life:duration,max:duration});startFx();
}
function starPath(r){
 ctx.beginPath();ctx.moveTo(0,-r);
 for(let i=1;i<8;i++){
  const a=i*Math.PI/4-Math.PI/2,length=i%2?r*.23:r;
  ctx.lineTo(Math.cos(a)*length,Math.sin(a)*length);
 }
 ctx.closePath();ctx.fill();
}
function gemTrail(){
 if(!earning||reduced.matches)return;
 const progress=earning.animation.effect.getComputedTiming().progress;
 if(progress<.55||progress>.99)return;
 const {x,y}=center(earning.sprite.firstChild);
 const point={x,y};
 if(earning.previous){
  particles.push({a:earning.previous,b:point,color:earning.color,side:0,type:'trail',life:.18,max:.18});
 }
 earning.previous=point;
}
function startFx(){if(!frame){last=performance.now();frame=requestAnimationFrame(draw);}}
function draw(now){
  const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;const bounds=canvas.getBoundingClientRect();
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,-bounds.left*pixelRatio,-bounds.top*pixelRatio);
  gemTrail();
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];if(p.delay>0){p.delay-=dt;continue;}p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
    const t=1-p.life/p.max;ctx.globalAlpha=Math.min(1,p.life*4);ctx.fillStyle=ctx.strokeStyle=p.color;
    if(p.type==='flare'){
      const spread=p.radius*(.3+Math.sin(t*Math.PI/2)*.73);
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=(1-t)**1.8;
      for(let ray=0;ray<14;ray++){
        ctx.rotate(Math.PI/7);const reach=spread*(ray%2 ? .68 : 1);
        ctx.fillStyle=ray%2?'#fff1ad':p.color;ctx.beginPath();ctx.moveTo(12,-4*(1-t));ctx.lineTo(reach,0);ctx.lineTo(13,4*(1-t));ctx.closePath();ctx.fill();
      }
      ctx.scale(1,.13);const light=ctx.createRadialGradient(0,0,0,0,0,spread);
      light.addColorStop(0,'#fffdf4');light.addColorStop(.24,p.color);light.addColorStop(1,'transparent');
      ctx.fillStyle=light;ctx.fillRect(-spread,-spread,2*spread,2*spread);ctx.restore();
    }else if(p.type==='inward'){
      const radius=p.radius*(1-t)**.8,angle=p.angle+t*1.25;
      ctx.globalAlpha=Math.sin(t*Math.PI);ctx.lineWidth=1+2*t;ctx.beginPath();
      ctx.moveTo(p.x+Math.cos(angle-.09)*(radius+12),p.y+Math.sin(angle-.09)*(radius+12)*.76);
      ctx.lineTo(p.x+Math.cos(angle)*radius,p.y+Math.sin(angle)*radius*.76);ctx.stroke();
    }else if(p.type==='trail'){
      ctx.lineCap='round';ctx.lineWidth=5*(1-t)+.5;ctx.beginPath();ctx.moveTo(p.a.x,p.a.y+p.side);ctx.lineTo(p.b.x,p.b.y+p.side);ctx.stroke();
      ctx.lineWidth=1;ctx.strokeStyle='#edfff9';ctx.stroke();
    }else if(p.type==='ring'){
      ctx.globalAlpha=(1-t)*.85;ctx.lineWidth=4*(1-t)+.6;ctx.beginPath();ctx.ellipse(p.x,p.y,5+100*t*p.power,3+55*t*p.power,0,0,Math.PI*2);ctx.stroke();
    }else if(p.type==='flight'){
      const x=p.a.x+(p.b.x-p.a.x)*t,y=p.a.y+(p.b.y-p.a.y)*t-75*Math.sin(t*Math.PI);
      const prev=Math.max(0,t-.07),px=p.a.x+(p.b.x-p.a.x)*prev,py=p.a.y+(p.b.y-p.a.y)*prev-75*Math.sin(prev*Math.PI);
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.lineWidth=2;ctx.stroke();
      ctx.save();ctx.translate(x,y);ctx.scale(.35+.65*Math.abs(Math.cos(t*11)),1);
      ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fillStyle='#ffce57';ctx.fill();ctx.strokeStyle='#87501c';ctx.lineWidth=1.3;ctx.stroke();
      ctx.fillStyle='#fff9d8';ctx.fillRect(-1,-3,2,6);ctx.restore();
    }else{
      const px=p.x,py=p.y;p.x+=p.dx*dt;p.y+=p.dy*dt;p.dy+=135*dt;
      ctx.save();ctx.translate(p.x,p.y);
      if(p.type==='comet'){
       ctx.rotate(Math.atan2(p.dy,p.dx));const length=(18+3*p.size)*(1-t);
       ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(0,-p.size*.43);ctx.lineTo(p.size,0);ctx.lineTo(0,p.size*.43);ctx.closePath();ctx.fill();
       ctx.fillStyle='#fffae0';ctx.fillRect(-length*.44,-.6,length*.5,1.2);
      }else if(p.type==='spark'){
       ctx.beginPath();ctx.moveTo((px-p.x)*3,(py-p.y)*3);ctx.lineTo(0,0);ctx.lineWidth=p.size*.42;ctx.stroke();
       ctx.fillStyle='#fffae8';ctx.beginPath();ctx.arc(0,0,p.size*.25,0,Math.PI*2);ctx.fill();
      }else if(p.type==='star'){
       ctx.rotate(t*p.spin);starPath(p.size*(1.6+.35*Math.sin(t*10)));
      }else{
       ctx.rotate(t*p.spin);ctx.beginPath();ctx.moveTo(0,-p.size);ctx.lineTo(p.size*.55,0);ctx.lineTo(0,p.size);ctx.lineTo(-p.size*.55,0);ctx.closePath();ctx.fill();
       ctx.fillStyle='#fff8';ctx.beginPath();ctx.moveTo(0,-p.size);ctx.lineTo(p.size*.55,0);ctx.lineTo(0,p.size*.45);ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.globalAlpha=1;frame=(particles.length||(earning&&!reduced.matches))?requestAnimationFrame(draw):0;
}
function hud(){
 $('gem').setAttribute('aria-expanded',String(opened||popup==='gem'));
 const s=current(),gems=earning?s.gems-1:s.gems,chestReady=!earning&&!breaking&&ready();
 const sockets=$('sockets');
 for(let i=0;i<goal;i++){
  const slot=sockets.children[i],filled=i<gems&&!opened;
  const savedColor=s.gemColors?.[i],color=Object.hasOwn(gemStyles,savedColor)?savedColor:data.gemStyle;
  slot.classList.toggle('filled',filled);
  slot.style.setProperty('--stone','url("assets/glass-'+color+'.webp")');
 }
 const showChest=chestReady&&!opened;
 $('bankedChest').src=chestSrc(data.chestStyle);$('bankedChest').hidden=!showChest;
 sockets.hidden=showChest;
 $('gem').classList.toggle('claim',showChest);$('gem').tabIndex=showChest?0:-1;
 $('gem').setAttribute('aria-label',chestReady?'보석상자 열기':'모은 보석 '+gems+'개, 다섯 개 필요');
 $('balance').textContent=balanceText();$('wallet').setAttribute('aria-label','통장 '+balanceText()+' · 내역 열기');
 $('lessonName').textContent=names[data.child]+' · '+surfaceTitle();$('lessonTitle').textContent=surfaceTitle();
 $('tip').textContent=opened?(activeRoll()?'금액을 모두 모으면 통장에 적립돼요.':'가운데 상자를 눌러 열어 보세요.'):chestReady?'목록 아래 상자를 눌러 열어 보세요.':'공부 보상을 받으면 보석이 목록 아래 빈 칸으로 날아가요.';
 const paused=Boolean(s.restReason);
 $('study').inert=paused;$('restState').hidden=!paused;$('restReason').textContent=s.restReason||'';
 updateRestClock();
 $('gem').disabled=paused;
 $('simulate').disabled=Boolean(earning)||breaking||opened||chestReady||paused;
 document.querySelectorAll('[data-child]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.child===data.child));});
}
function lesson(){
 const activity=$('surface').value==='activity';
 $('samplePage').hidden=activity;$('capture').hidden=!activity;
 $('sampleSource').textContent=(activity?'공부 화면 캡처':'화면 배치 예시')+' · 체험용 잔액';
 renderToolbar();
 if(!activity){renderSamplePage();return;}
 const s=current(),shot=(data.child==='seoin'&&s.clue?'clue':data.child)+'-'+($('study').clientWidth<=650?'narrow':'wide');
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
function choose(child){if(opened)closeReward();cancelGem();closePopup();$('toast').hidden=true;data.child=child;save();lesson();hud();applyViewSettings();}
document.querySelectorAll('[data-child]').forEach(b=>b.onclick=()=>choose(b.dataset.child));

let fractureRun=0;
async function shatterGems(owner){
 const run=++fractureRun,tray=$('sockets');
 if(!reduced.matches){
  const pieces=[];
  for(const [i,slot] of [...tray.children].entries()){
   for(let j=0;j<3;j++){
    const shard=document.createElement('span');
    shard.className='shard part'+j;slot.append(shard);
    const x=(j-1)*15+(i-2)*5,y=-14-(i+j)%3*7;
    const animation=shard.animate([{transform:'none',opacity:1},{offset:.55,transform:'translate('+x+'px,'+y+'px) rotate('+(i-j)*18+'deg)',opacity:1},{transform:'translate('+x*1.6+'px,5px) scale(.22)',opacity:0}],{delay:95+i*18,duration:440,fill:'both'});
    pieces.push(animation.finished.catch(()=>{}));
   }
  }
  tray.classList.add('fracture');await Promise.all(pieces);
 }
 if(run!==fractureRun||current()!==owner)return;
 clearFracture();hud();
 if(!owner.restReason)openReward(Boolean(popup));
}
function clearFracture(){
 fractureRun++;breaking=false;
 $('sockets').classList.remove('fracture');
 for(const shard of $('sockets').querySelectorAll('.shard')){for(const a of shard.getAnimations())a.cancel();shard.remove();}
}
function cancelGem(){
 if(breaking)clearFracture();
 if(!earning)return;
 earning.animation.cancel();earning.sprite.remove();earning=null;
}
function earn(source){
 if(earning||opened||ready())return;
 closePopup();unlock();
 const s=current();if(!Array.isArray(s.gemColors))s.gemColors=Array(s.gems).fill(data.gemStyle);
 s.gemColors[s.gems]=data.gemStyle;s.gems++;save();
 const at=center(source===$('simulate')?$('study'):source),target=center($('sockets').children[s.gems-1]);
 const sprite=document.createElement('span');sprite.className='flyingGem';sprite.ariaHidden='true';
 const art=document.createElement('img');art.src=gemSrc();art.alt='';
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
 const color=gemStyles[data.gemStyle][1];
 earning={animation,sprite,color};hud();creditSpark(art,[color,'#fff7c7','#e3fffa'],19,.55);tone(659,0,.18,'sine');tone(1318,.06,.18,'sine');
 animation.onfinish=()=>{
  if(earning?.animation!==animation)return;
  sprite.remove();earning=null;breaking=s.gems===goal;hud();
  const slot=$('sockets').children[s.gems-1];
  creditSpark(slot,[color,...green],18,.42);
  tone(988);if(s.gems===goal){
   tone(1244,.10);notify('보석 다섯 개. 보석상자 열기');
   shatterGems(s);
  }
  else notify('보석 '+s.gems+'개');
 };
}
$('simulate').onclick=()=>{
 const bar=document.querySelector('.studybar');
 if(bar.getBoundingClientRect().top<0)bar.scrollIntoView({block:'start',behavior:'instant'});
 earn($('simulate'));
};
function closePopup(){popup='';$('popover').hidden=true;for(const id of ['menu','list','gem','wallet','rest'])$(id).setAttribute('aria-expanded','false');}
function popText(text){const p=document.createElement('p');p.textContent=text;$('popBody').append(p);}
function row(text,click,parent=$('popBody')){const b=document.createElement('button');b.className='row';b.textContent=text;b.onclick=click;parent.append(b);}
function positionPopup(){
 if(!popup)return;
 const host=document.querySelector('.screen').getBoundingClientRect();
 const box=$('popover'),button=$(popup).getBoundingClientRect();
 const start=['menu','rest'].includes(popup)?button.right-host.left-box.offsetWidth:button.left-host.left;
 box.style.left=Math.max(4,Math.min(start,host.width-box.offsetWidth-5))+'px';box.style.right='auto';
}
function showPopup(kind){
 if(opened)closeReward();if(popup===kind){closePopup();return;}
 closePopup();popup=kind;$('toast').hidden=true;const box=$('popover'),s=current();
 box.hidden=false;box.classList.toggle('menu',kind==='menu');box.dataset.panel=kind;$(kind).setAttribute('aria-expanded','true');$('popBody').replaceChildren();
 $('popTitle').textContent={gem:'모은 보석',wallet:names[data.child]+'의 체험 통장',list:'공부 목록',menu:$('surface').value==='home'?'설정':'보기 메뉴',rest:'쉬는 시간'}[kind];
 if(kind==='wallet'){
  popText($('sample').value==='offline'?'통장 연결 확인 중':'현재 잔액 '+won(balance()));
  if(!s.ledger.length)popText('상자를 열면 여기에 적립 내역이 생겨.');
  s.ledger.slice().reverse().forEach((v,i)=>{const li=document.createElement('div'),n=document.createElement('b');li.className='ledger';li.append('보석상자 '+(s.ledger.length-i)+'회');n.textContent='+'+won(v);li.append(n);$('popBody').append(li);});
 }else if(kind==='gem'){
  const m=document.createElement('div');m.className='meter';for(let i=0;i<goal;i++){const g=document.createElement('i');if(i<s.gems)g.className='on';m.append(g);}$('popBody').append(m);popText('보석 '+(goal-s.gems)+'개를 더 모으면 상자가 열려.');
 }else if(kind==='list'){
  if($('surface').value==='home'){
   for(const day of ['11.23','11.22'])row(day+' 숙제',()=>{sampleDay=day;closePopup();lesson();hud();});
  }
  for(const option of $('surface').options)row(surfaceTitle(option.value),()=>changeSurface(option.value));
 }
 else if(kind==='rest'){renderRestChoices();}
 else{
  renderViewMenu();
  for(const tool of $('quickTools').children)if(!tool.getClientRects().length)row(tool.textContent,()=>useTool(tool.textContent));
  const more=document.createElement('details'),summary=document.createElement('summary');summary.textContent='보상';more.append(summary);$('popBody').append(more);
  row($('gem').ariaLabel,()=>$('gem').click(),more);
  row('통장 내역 · '+balanceText(),()=>showPopup('wallet'),more);
  row(data.sound?'효과음 끄기':'효과음 켜기',()=>{data.sound=!data.sound;unlock();save();closePopup();showPopup('menu');$('popBody').querySelector('details').open=true;},more);
 }
 positionPopup();
}
$('listen').onclick=()=>useTool('듣기');
$('rest').onclick=()=>showPopup('rest');$('resume').onclick=()=>setRest('');
$('list').onclick=()=>showPopup('list');$('menu').onclick=()=>showPopup('menu');$('wallet').onclick=()=>showPopup('wallet');
$('gem').onclick=()=>{if(earning||breaking)return;if(opened)closeReward();else if(ready())openReward();else showPopup('gem');};$('popClose').onclick=()=>{const id=popup;closePopup();$(id)?.focus();};
document.addEventListener('pointerdown',e=>{if(popup&&!e.target.closest('.popover,.studybar,#gem'))closePopup();});
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
 layer.classList.remove('finalBurst');
 layer.classList.toggle('charging',charging);
 layer.classList.toggle('finalBeat',activeRoll()&&current().rolls.length-current().shown===1);
 layer.dataset.design=data.chestStyle;
 chest.disabled=activeRoll();
 $('chestArt').src=chestSrc(data.chestStyle,activeRoll());
}
function openReward(underPopup=false){
 if(opened||earning||breaking||!ready()||current().restReason)return;
 if(!underPopup)closePopup();unlock();$('toast').hidden=true;opened=true;layer.hidden=false;
 drops.replaceChildren();current().rolls.slice(0,current().shown).forEach(addDrop);
 paintChest();hud();
 if(activeRoll())scheduleNext();
 else {if(!underPopup)chest.focus({preventScroll:true});tone(392,0,.19);}
}
function closeReward(){
 if(!opened)return;
 if(document.activeElement===chest)$('list').focus({preventScroll:true});
 clearTimeout(revealTimer);clearTimeout(chargeTimer);charging=false;
 opened=false;layer.hidden=true;drops.replaceChildren();hud();
}
function roll(low,high){return low+Math.floor(Math.random()*(high-low+1));}
function openChest(){
 if(!opened||activeRoll()||!charging)return;
 const s=current();charging=false;s.gems=0;s.gemColors=[];
 const count=roll(standardChest.minDrops,standardChest.maxDrops);
 s.rolls=Array.from({length:count},()=>roll(1,maxWonPerDrop));s.shown=0;
 save();paintChest();hud();
 const style=chestStyles[data.chestStyle];
 impact(chest,style.accent,style.power);
 burst(chest,[style.accent,'#ffd431','#ff9234','#fffcf0'],Math.round(55*style.power),style.power);
 if(!reduced.matches)$('chestArt').animate([{transform:'scale(1.06,.90)',filter:'brightness(1.5)'},{transform:'scale(.98,1.06)',offset:.38},{transform:'scale(1)'}],{duration:360});
 tone(131,0,.26,'sine');
 [246,392,523,784].forEach((f,i)=>tone(f,i*.07,.20));scheduleNext();
}
chest.onclick=()=>{
 if(!opened||charging||activeRoll())return;
 charging=true;paintChest();unlock();converge(chest,chestStyles[data.chestStyle].accent,.84);
 [185,233,311,466].forEach((f,i)=>tone(f,i*.17,.12));
 chargeTimer=setTimeout(openChest,reduced.matches?60:840);
};
function scheduleNext(){
 clearTimeout(revealTimer);
 if(!opened||!activeRoll())return;
 const s=current(),remaining=s.rolls.length-s.shown;
 layer.classList.toggle('finalBeat',remaining===1);
 if(remaining===1){converge(chest,chestStyles[data.chestStyle].accent,reduced.matches ? .3 : 1.16);tone(233,.20,.13);tone(311,.57,.16);}
 if(!remaining){
  revealTimer=setTimeout(collect,reduced.matches?200:900);return;
 }
 const delay=remaining===1?1160:s.shown===0?360:650;
 revealTimer=setTimeout(reveal,reduced.matches?300:delay);
}
function reveal(){
 const s=current(),value=s.rolls[s.shown];s.shown++;save();
 const item=addDrop(value),lastDrop=s.shown===s.rolls.length;
 const accent=chestStyles[data.chestStyle].accent;
 if(lastDrop){layer.classList.add('finalBurst');impact(chest,accent,1.2);tone(98,0,.31,'sine');}
 creditSpark(item,[accent,...gold],lastDrop ? 48 : 19,lastDrop ? .96 : .63);
 if(!reduced.matches)$('chestArt').animate([{transform:'scale(1)'},{transform:'scale(1.06,.94)'},{transform:'scale(.98,1.04)'},{transform:'scale(1)'}],{duration:270});
 const note=392*2**((s.shown-1)/6);
 tone(note,0,.23);tone(note*2,.035,.16,'sine');if(lastDrop||value>=8)tone(note*3,.10,.20,'sine');
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
 closeReward();bop($('wallet'));creditSpark($('wallet'),gold,30,.75);
 [784,988,1175].forEach((f,i)=>tone(f,i*.09,.22));toast('통장에 +'+won(credit));
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(opened)closeReward();else closePopup();}});
addEventListener('pagehide',()=>{cancelGem();closeReward();});
addEventListener('pageshow',e=>{if(e.persisted)hud();});

let sampleDay='11.23';
function surfaceTitle(surface=$('surface').value){
 return {activity:lessons[data.child],home:'숙제 목록',book:'리딩 · The Lantern in the Garden',question:'영어 공부질문'}[surface];
}
function changeSurface(value){
 closeReward();cancelGem();closePopup();$('toast').hidden=true;$('surface').value=value;lesson();hud();
}
const inlineTools={
 home:['클릭질문'],
 book:['클릭질문','음성질문'],
 question:['클릭질문'],
 activity:['클릭질문','음성질문']
};
function useTool(label){
 closeReward();closePopup();
 if(label==='황금시계'){showPopup('rest');return;}
 if(label==='클릭질문'||label==='음성질문'){changeSurface('question');return;}
 toast(label+' · 목업 미리보기');
}
function renderToolbar(){
 const surface=$('surface').value,home=surface==='home';
 $('listLabel').textContent=home?sampleDay:'목록';
 if(surface==='book'){
  const detail=document.createElement('em');detail.className='listDetail';detail.textContent=' · 리딩 1 / 3';$('listLabel').append(detail);
 }
 $('list').ariaLabel=home?'숙제 날짜 '+sampleDay:'공부 목록';
 $('list').firstElementChild.textContent=home?'▦':'☷';
 $('quickTools').replaceChildren();
 for(const label of inlineTools[surface]){
  const button=document.createElement('button');button.className='tool';button.textContent=label;
  button.onclick=()=>useTool(label);$('quickTools').append(button);
 }
}
function renderSamplePage(){
 const page=$('samplePage'),surface=$('surface').value;page.replaceChildren();page.dataset.surface=surface;
 function add(tag,text){const el=document.createElement(tag);el.textContent=text;page.append(el);return el;}
 if(surface==='home'){
  add('small',names[data.child]+' · '+sampleDay);add('h2','오늘의 숙제');
  for(const [key,label] of [['question','공부 영어질문'],['book',surfaceTitle('book')],['activity',lessons[data.child]]]){
   const b=add('button',label);b.className='homeActivity';b.onclick=()=>changeSurface(key);
  }
 }else if(surface==='book'){
  add('small','READING · 1 / 3');add('h2','The Lantern in the Garden');
  add('p','At the garden gate, a little lantern swung in the wind. Mina held it still and saw a tiny silver key beneath the leaves.');
  add('p','She lifted the key. Across the path, a wooden door stood half open.');
 }else{
  add('small',names[data.child]+' · 영어');add('h2','영어 공부질문');add('p','어떤 영어 표현이 궁금해?');
  const b=add('button','질문 고르기');b.className='homeActivity';b.onclick=()=>{b.replaceWith(document.createTextNode('“beneath the leaves”는 무슨 뜻일까?'));};
 }
}
$('surface').onchange=()=>changeSurface($('surface').value);
$('sample').onchange=()=>{closePopup();hud();};
$('device').onchange=()=>{
 const [w,h]=$('device').value.split('x').map(Number),frame=$('previewFrame');
 frame.style.width=w?w+'px':'';frame.style.setProperty('--mock-height',h?h+'px':'');
};
let previousNarrow,previousMenuWidth;
new ResizeObserver(()=>{
 const width=$('study').clientWidth,narrow=width<=650;
 $('sizeReadout').textContent=width+' px';
 if(narrow!==previousNarrow){previousNarrow=narrow;lesson();}
 if(popup==='menu'&&previousMenuWidth!==width){const scroll=$('popover').scrollTop;closePopup();showPopup('menu');$('popover').scrollTop=scroll;}
 previousMenuWidth=width;
 positionPopup();arrangeDrops();
}).observe($('study'));
$('studyImage').onload=()=>{
 const img=$('studyImage');
 if(img.naturalHeight)$('capture').style.setProperty('--shot-ratio',img.naturalWidth/img.naturalHeight);
};
for(let i=0;i<goal;i++)$('sockets').append(document.createElement('i'));
const demoParams=new URLSearchParams(location.search);
if([...$('surface').options].some(o=>o.value===demoParams.get('surface')))$('surface').value=demoParams.get('surface');
lesson();buildCollection();applyViewSettings();
setInterval(()=>{if(!document.hidden&&current().restReason==='쉬기')updateRestClock();},1000);
if(['list','menu','rest'].includes(demoParams.get('panel')))showPopup(demoParams.get('panel'));
