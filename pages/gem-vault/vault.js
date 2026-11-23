'use strict';
const $=id=>document.getElementById(id);
const goal=5,slotCount=5,key='gem-vault.demo.v1',reduced=matchMedia('(prefers-reduced-motion: reduce)');
const fresh=()=>({gems:4,balance:0,phase:'collect',rolls:[],shown:0,sound:false});
function restore(){
  try{
    const s=JSON.parse(sessionStorage.getItem(key));
    if(!s||!Number.isSafeInteger(s.balance)||s.balance<0||!Number.isInteger(s.gems)||s.gems<0||s.gems>goal||!Array.isArray(s.rolls))return fresh();
    const closed=(s.phase==='collect'&&s.gems<goal||s.phase==='ready'&&s.gems===goal)&&s.shown===0&&s.rolls.length===0;
    const opened=s.gems===0&&s.rolls.length===slotCount&&s.rolls.every(v=>Number.isInteger(v)&&v>=1&&v<=10)&&
      (s.phase==='reveal'&&Number.isInteger(s.shown)&&s.shown>=0&&s.shown<slotCount||s.phase==='done'&&s.shown===slotCount);
    return closed||opened?s:fresh();
  }catch{return fresh();}
}
let state=restore(),audioContext,timer,lockedUntil=0;
function save(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch{/* The demo also runs in memory. */}}
const art={collect:'gem',ready:'chest',reveal:'open',done:'open'};
const messages={
  collect:['보석 5개를 모아 상자를 열어 봐!','보석 받기 +1','상자를 열면 카드가 한 장씩 뒤집혀.'],
  ready:['보석상자가 나타났어! 상자를 눌러 봐.','상자 열기','다섯 장에는 각각 얼마가 들어 있을까?'],
  reveal:['다섯 장의 카드에 숨은 금액을 확인해 봐.','카드 공개 중…','왼쪽 카드부터 차례로 공개 중이야.'],
  done:['카드를 모두 열었어! 모은 금액을 확인해 봐.','다음 상자 모으기','']
};
const cards=Array.from({length:slotCount},(_,i)=>{
  const li=document.createElement('li');li.className='card';
  const num=document.createElement('span');num.className='ordinal';num.textContent=String(i+1).padStart(2,'0');num.ariaHidden='true';
  const face=document.createElement('span');face.className='mark';li.append(num,face);$('cards').append(li);
  return {li,face};
});
for(let i=0;i<22;i++){
  const star=document.createElement('i');star.style.cssText='left:'+((i*37+9)%98)+'%;top:'+((i*19+8)%80)+'%;animation-delay:-'+(i*.31)+'s';
  document.querySelector('.motes').append(star);
}
const sum=()=>state.rolls.slice(0,state.shown).reduce((a,b)=>a+b,0);
const won=n=>n.toLocaleString('ko-KR')+'원';
function render(){
  const {phase}=state,[hint,action,caption]=messages[phase],opened=phase==='reveal'||phase==='done';
  $('arena').className='arena '+phase;$('relic').src='assets/'+art[phase]+'.png';
  $('play').querySelector('img').src='assets/'+art[phase]+'.png';$('buttonText').textContent=action;
  $('loot').disabled=opened;$('loot').setAttribute('aria-label',action);$('play').disabled=phase==='reveal';
  $('hint').textContent=hint;$('count').textContent=state.gems;
  document.querySelectorAll('.segments i').forEach((n,i)=>n.classList.toggle('on',i<state.gems));
  $('total').textContent=sum();$('balance').textContent=won(state.balance);
  $('caption').textContent=phase==='done'?'이번 상자에서 받은 '+won(sum())+'을 체험 잔액에 더했어.':caption;
  $('audio').setAttribute('aria-pressed',String(state.sound));
  $('audio').title=state.sound?'효과음 끄기':'효과음 켜기';$('audio').setAttribute('aria-label',$('audio').title);
  $('audio').querySelector('.waves').textContent=state.sound?'♪':'×';
  cards.forEach(({li,face},i)=>{
    const revealed=opened&&i<state.shown;
    const style=revealed?'flipped'+(state.rolls[i]>=8?' high':''):opened?'mystery':'sealed';
    if(li.dataset.style===style)return;
    li.dataset.style=style;li.className='card '+style;
    li.style.animationDelay=style==='mystery'?i*.04+'s':'0s';face.replaceChildren();
    if(revealed){
      const value=document.createElement('b'),unit=document.createElement('small');
      value.className='value';value.textContent=state.rolls[i];unit.textContent='원';value.append(unit);face.append(value);
    }else if(opened){face.textContent='?';}
    else{const seal=document.createElement('i');seal.className='seal';face.append(seal);}
    li.setAttribute('aria-label',(i+1)+'번째 카드, '+(revealed?won(state.rolls[i]):opened?'물음표':'잠김'));
  });
}
function tone(hz,delay=0,length=.13,type='triangle'){
  if(!state.sound||!audioContext||audioContext.state!=='running')return;
  const t=audioContext.currentTime+delay,osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type;osc.frequency.setValueAtTime(hz,t);gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(.065,t+.013);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
  osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+length+.01);
}
function unlockSound(){
  if(!state.sound)return;
  try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}
}
$('audio').onclick=()=>{state.sound=!state.sound;unlockSound();save();render();if(state.sound)setTimeout(()=>tone(700),50);};
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
  const dt=Math.min(.05,(now-last)/1000);last=now;ctx.clearRect(0,0,innerWidth,innerHeight);
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
    const t=1-p.life/p.max;ctx.globalAlpha=Math.min(1,p.life*4);ctx.fillStyle=ctx.strokeStyle=p.color;
    if(p.type==='ring'){
      ctx.lineWidth=3*(1-t)+1;ctx.beginPath();ctx.ellipse(p.x,p.y,5+100*t*p.power,3+55*t*p.power,0,0,Math.PI*2);ctx.stroke();
    }else if(p.type==='flight'){
      const x=p.a.x+(p.b.x-p.a.x)*t,y=p.a.y+(p.b.y-p.a.y)*t-75*Math.sin(t*Math.PI);
      ctx.fillRect(x-4,y-5,8,10);ctx.fillStyle='#fff4ab';ctx.fillRect(x-2,y-3,2,5);
    }else{
      p.x+=p.dx*dt;p.y+=p.dy*dt;p.dy+=135*dt;ctx.save();ctx.translate(p.x|0,p.y|0);ctx.rotate(t*p.spin);
      ctx.fillRect(-p.size,-p.size*.35,p.size*2,p.size*.7);if(p.type==='star')ctx.fillRect(-p.size*.35,-p.size,p.size*.7,p.size*2);ctx.restore();
    }
  }
  ctx.globalAlpha=1;frame=particles.length?requestAnimationFrame(draw):0;
}
function pop(el,style){el.classList.remove(style);void el.offsetWidth;el.classList.add(style);}
function announce(text){$('announce').textContent=text;}
function revealNext(){
  if(state.phase!=='reveal')return;
  const i=state.shown++;const amount=state.rolls[i],lastCard=state.shown===slotCount;
  if(lastCard){state.phase='done';state.balance+=sum();}
  save();render();
  const card=cards[i].li;burst(card,gold,lastCard?58:28,lastCard?1.2:.75);coinFlight(card,lastCard?$('balance'):$('total'));
  pop($('total').parentElement.parentElement,'pulse');tone([440,554,659,784,988][i]);
  if(lastCard){
    burst($('relic'),gold,65);pop(document.querySelector('.wallet'),'bump');
    [784,988,1175,1568].forEach((f,j)=>tone(f,j*.095,.24));announce('상자를 모두 열었어. 총 '+won(sum())+' 적립!');
  }else{announce((i+1)+'번째 카드 '+won(amount));schedule(680);}
}
function schedule(ms){clearTimeout(timer);timer=setTimeout(revealNext,ms);}
function activate(){
  if(state.phase==='reveal'||performance.now()<lockedUntil)return;
  lockedUntil=performance.now()+220;unlockSound();
  if(state.phase==='done'){
    state.phase='collect';state.gems=0;state.rolls=[];state.shown=0;announce('새 상자의 보석을 모아 봐.');
  }else if(state.phase==='collect'){
    state.gems++;burst($('relic'),green,30);tone(660);tone(990,.075);
    $('callout').textContent='+1';pop($('callout'),'lift');
    if(state.gems===goal){
      state.phase='ready';burst($('relic'),gold,55);[660,880,1100].forEach((f,j)=>tone(f,.12+j*.09));announce('보석 다섯 개! 보석상자가 나타났어.');
    }else announce('모은 보석 '+state.gems+'개');
  }else if(state.phase==='ready'){
    state.phase='reveal';state.gems=0;state.shown=0;
    state.rolls=Array.from({length:slotCount},()=>Math.floor(Math.random()*10)+1);
    burst($('relic'),gold,82,1.25);[220,330,440,660].forEach((f,j)=>tone(f,j*.085,.23));announce('상자가 열렸어. 금액을 차례로 공개할게.');
    cards.forEach(({li},i)=>coinFlight($('relic'),li,.45+i*.09));
    schedule(900);
  }
  save();render();
}
$('play').onclick=activate;$('loot').onclick=activate;
render();if(state.phase==='reveal')schedule(800);
