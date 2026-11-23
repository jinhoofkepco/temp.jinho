'use strict';
const page = document.querySelector('#page');
const labels = {listen:'귀로 찾는 빈칸',summary:'기억으로 잇는 네 문장',scene:'그림 속 여덟 단어',motion:'조건 하나 바꾸기',rewind:'이야기 되감기',drawers:'한 장씩 분류하기'};
const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const ledgerKey = 'river-notes-focus:v1:'+day;
let ledger = {};
try { ledger = JSON.parse(localStorage.getItem(ledgerKey)||'{}') || {}; } catch {}
let s = {}, audio, frame, observer, timer;
const mix = list => {
  const copy = list.slice();
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
};
const esc = x => String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const button = (text,act,cls='',disabled=false) => '<button class="'+cls+'" data-act="'+act+'"'+(disabled?' disabled':'')+'>'+esc(text)+'</button>';
const art = (n,alt='') => '<img src="art/'+n+'.webp" alt="'+esc(alt)+'">';
const layout = (n,body,alt='') => '<section class="layout"><aside class="illustration">'+art(n,alt)+'</aside><div class="work">'+body+'</div></section>';
const bar = (kind,info) => '<div class="bar"><h1>'+labels[kind]+'</h1><small>'+esc(info)+'</small></div>';
const total = () => Object.values(ledger).reduce((n,r)=>n+(Number(r.amount)||0),0);
function score(id,label,good) {
  const key='edition2-'+id;
  if(!ledger[key]){
    const roll=Math.random();
    ledger[key]={label,amount:good?(roll<.65?10:roll<.9?12:15):0,solved:good};
  } else if(good) ledger[key].solved=true;
  try {localStorage.setItem(ledgerKey,JSON.stringify(ledger));} catch {}
  document.querySelector('#sum').textContent=total()+'원';
}
function stopAudio(){
  cancelAnimationFrame(frame);
  if(audio){audio.onended=audio.onerror=null;audio.pause();audio=null;}
}
function cleanup(){stopAudio();clearTimeout(timer);observer?.disconnect();observer=null;}
function openHome(){
  cleanup();s={};page.innerHTML='<section class="hero"><article><h1>집중력 퀴즈</h1><p>강가의 이야기와 과학 노트</p></article>'+art(2,'강 위에서 피리를 부는 뱃사공')+'</section><div class="cards">'+
  [['listen',1,'문학·과학 · 10문장'],['summary','memory-1','과학 · 분류 체계'],['scene','situations-1','그림과 맞는 문장'],['motion','situations-9','속력과 방향'],['rewind','memory-7','미나의 이야기'],['drawers','memory-4','생물 이름표']].map(([k,n,sub])=>'<button class="card" data-act="'+k+'">'+art(n)+'<strong>'+labels[k]+'</strong><small>'+sub+'</small></button>').join('')+'</div>';
  window.scrollTo(0,0);
}
function finish(note){cleanup();s.mode='finished';page.innerHTML=bar(s.kind,'완료')+'<section class="done">'+art(({scene:'situations-1',summary:'memory-3',motion:'situations-9',rewind:'memory-9'})[s.kind]||2)+'<h2>'+esc(note)+'</h2><p>오늘 모은 모의 보상 <b>'+total()+'원</b></p>'+button('퀴즈 목록','home','primary')+'</section>';window.scrollTo(0,0);}
function options(opts){return '<div class="choice-list">'+opts.map((v,i)=>button(v,'pick-'+i,'slot-btn')).join('')+'</div>';}
function play(src,onTick,onEnd,onError){
  stopAudio();const clip=audio=new Audio(src);
  const tick=()=>{if(clip!==audio)return;onTick?.(clip.currentTime);frame=requestAnimationFrame(tick);};
  clip.onended=()=>{if(clip!==audio)return;stopAudio();onEnd?.();};
  clip.onerror=()=>{if(clip!==audio)return;stopAudio();onError?.();};
  clip.play().then(tick).catch(()=>{if(clip===audio)clip.onerror();});
}
function goTo(el){el?.scrollIntoView({block:'center',behavior:'instant'});}
function passageStart(index=0){
  cleanup();const p=CONTENT.passages[index];
  s={kind:'listen',mode:'study',p,index,seen:new Set(),last:new Map(),queue:[],round:0,stumbles:false};
  drawPassage();window.scrollTo(0,0);
}
function fullText(l){return l.before+l.target+l.after;}
function studyCount(){
  if(s.mode!=='study')return;
  document.querySelector('#readcount').textContent=s.seen.size+' / '+s.p.lines.length+'문장';
  document.querySelector('[data-act="begin"]').disabled=s.seen.size<s.p.lines.length;
}
function trackExposure(){
  observer?.disconnect();
  observer=new IntersectionObserver(entries=>{
    if(s.mode!=='study')return;
    entries.forEach(e=>{if(e.isIntersecting)s.seen.add(Number(e.target.dataset.line));});studyCount();
  },{threshold:0.65});
  page.querySelectorAll('[data-line]').forEach(el=>observer.observe(el));
}
function drawPassage(){
  const {p}=s, study=s.mode==='study',review=s.mode==='review';
  const tabs=study?'<div class="row">'+CONTENT.passages.map((v,i)=>button(i===0?'문학':'과학','passage-'+i,i===s.index?'tab on':'tab')).join('')+'</div>':'';
  const rows=p.lines.map((l,i)=>{
    let inner=esc(fullText(l)),extra='',active=s.mode==='test'&&s.deck[s.pos]===i;
    if(!study&&s.deck.includes(i)){
      const chosen=s.picks[i];let shown=chosen?esc(chosen):'___',cls=chosen?'answered':'';
      if(review){const good=chosen===l.target;cls=good?'right':'wrong';shown=good?'✓ '+esc(l.target):'<s>'+esc(chosen)+'</s> → '+esc(l.target);}
      inner=esc(l.before)+'<span class="slot '+cls+'">'+shown+'</span>'+esc(l.after);
      if(active){
        inner=l.maskTime.map(([word])=>word==='____'?'<span class="slot fading">___</span>':'<span class="fading">'+esc(word)+'</span>').join(' ')+(l.after.trim().endsWith('.')||l.after==='.'?'.':'');
        extra='<span class="inline-quiz"><span class="meta">'+(s.pos+1)+' / 3</span> '+button('다시 듣기','repeat','replay')+'<span id="picks"></span><small id="audioNote"></small></span>';
      }
    }
    return '<span class="line'+(active?' active-line':'')+'" data-line="'+i+'">'+inner+'</span> '+extra;
  });
  const paragraphs=[rows.slice(0,3),rows.slice(3,7),rows.slice(7)].map(a=>'<div class="paragraph">'+a.join(' ')+'</div>').join('');
  let dock='';
  if(study)dock='<div class="quiz-dock"><span id="readcount"></span>'+button('빈칸 퀴즈 · 3개','begin','primary',true)+'</div>';
  if(review){
    const missed=s.deck.filter(i=>s.picks[i]!==p.lines[i].target);
    const marks=s.deck.map((i,k)=>{const a=p.lines[i].target;const ok=s.picks[i]===a;return '<button data-act="locate-'+i+'" class="'+(ok?'right':'wrong')+'">'+(k+1)+' · '+(ok?'✓ ':'✕ ')+esc(ok?a:s.picks[i]+' → '+a)+'</button>';}).join(' ');
    dock='<div class="row review-list">'+marks+'</div><div class="quiz-dock" id="result"><div><b>'+ (3-missed.length)+' / 3</b><div>'+ (s.queue.length?'틀린 자리와 다른 두 자리를 다시 풀어 봐.':'세 빈칸을 모두 맞혔어.')+'</div></div>'+button(s.queue.length?'다시 도전':'마치기',s.queue.length?'retry':'finish-listen','primary')+'</div>';
  }
  page.innerHTML=bar('listen',study?'읽기':review?'세 답 확인':'본문 빈칸')+layout(p.art,tabs+'<h2>'+esc(p.title)+'</h2>'+(study?'<p>'+button('지문 듣기','narrate','compact')+'</p>':'')+'<div class="passage" lang="en">'+paragraphs+'</div>'+dock);
  if(study){trackExposure();studyCount();}else if(review)goTo(document.querySelector('#result'));else{goTo(page.querySelector('.active-line'));playGap();}
}
function narrate(i=0){
  if(s.mode!=='study')return;
  const ctrl=page.querySelector('[data-act=narrate]');ctrl.textContent='듣기 멈춤';ctrl.dataset.act='stop-reading';
  page.querySelector('.active-line')?.classList.remove('active-line');
  const el=page.querySelector('[data-line="'+i+'"]');el.classList.add('active-line');goTo(el);
  play('audio/'+s.p.id+'-'+(i+1)+'.mp3',null,()=>{
    s.seen.add(i);studyCount();
    if(i+1<s.p.lines.length){ctrl.dataset.act='narrate';narrate(i+1);}else endNarration();
  },()=>{endNarration();document.querySelector('#readcount').textContent='음원을 열 수 없어요. 글로 읽을 수 있어요.';});
}
function endNarration(){stopAudio();page.querySelector('.active-line')?.classList.remove('active-line');const b=page.querySelector('[data-act=stop-reading]');if(b){b.textContent='지문 듣기';b.dataset.act='narrate';}}
function preferred(ids){return mix(ids).sort((a,b)=>(s.last.get(a)||0)-(s.last.get(b)||0)||s.p.lines[b].priority-s.p.lines[a].priority);}
function round(retry){
  cleanup();const indices=s.p.lines.map((_,i)=>i);
  if(retry){const wrong=s.queue.shift();const pool=indices.filter(i=>i!==wrong&&!s.queue.includes(i));const others=[...preferred(pool),...s.queue].slice(0,2);s.queue=s.queue.filter(i=>!others.includes(i));s.deck=[wrong,...others];}
  else{s.deck=[indices.slice(0,3),indices.slice(3,7),indices.slice(7)].map(pool=>preferred(pool)[0]);}
  s.round++;s.deck.sort((a,b)=>a-b).forEach(i=>s.last.set(i,s.round));
  s.pos=0;s.picks={};s.mode='test';setGap();
}
function setGap(){const l=s.p.lines[s.deck[s.pos]];s.opts=mix([l.target,...l.foils]);s.ready=false;drawPassage();}
function playGap(){
  const idx=s.deck[s.pos], l=s.p.lines[idx];const words=[...page.querySelectorAll('.active-line .fading')];
  const picks=page.querySelector('#picks');picks.innerHTML='';s.ready=false;let n=0;
  words.forEach(el=>el.classList.remove('shown'));
  function reveal(t){while(n<words.length&&l.maskTime[n][1]<=t)words[n++].classList.add('shown');}
  function done(fail=false){reveal(Infinity);s.ready=true;picks.innerHTML=options(s.opts);if(fail)page.querySelector('#audioNote').textContent='음원을 열 수 없어 글로 풀 수 있어요.';}
  play('audio/'+s.p.id+'-'+(idx+1)+'-gap.mp3',reveal,()=>done(),()=>done(true));
}
function pickGap(value){
  if(!s.ready)return;s.ready=false;const idx=s.deck[s.pos];s.picks[idx]=value;
  if(++s.pos<3){setGap();return;}
  s.deck.forEach(i=>{if(s.picks[i]!==s.p.lines[i].target&&!s.queue.includes(i))s.queue.push(i);});
  if(s.queue.length){s.stumbles=true;score('listen-'+s.p.id,labels.listen+' · '+s.p.title,false);}
  else score('listen-'+s.p.id,labels.listen+' · '+s.p.title,true);
  s.mode='review';drawPassage();
}
function studyFacts(note=''){
  cleanup();s={kind:'summary',mode:'facts',misses:0,answers:[],pos:0};
  page.innerHTML=bar('summary','과학 · Classification Systems')+'<h2>생물을 어떻게 나눌까?</h2>'+(note?'<p class="explain" role="status">'+esc(note)+'</p>':'')+'<div class="fact-gallery">'+CONTENT.facts.map(f=>'<figure>'+art(f.art,f.alt)+'<figcaption><span class="spec-label">'+esc(f.caption)+'</span><p lang="en">'+esc(f.lead)+' <b>'+esc(f.a.answer)+'</b>'+esc(f.join)+'<b>'+esc(f.b.answer)+'</b>'+esc(f.end)+'</p></figcaption></figure>').join('')+'</div><p>'+button('기억으로 잇기','recall','primary')+'</p>';
  window.scrollTo(0,0);
}
function showFact(){
  s.mode='recall';const idx=Math.floor(s.pos/2), second=Boolean(s.pos%2),f=CONTENT.facts[idx],slot=second?f.b:f.a;
  s.opts=mix([slot.answer,...slot.foils]);
  page.innerHTML=bar('summary',(idx+1)+' / 4문장')+layout(f.art,'<h2>기억나는 뜻을 이어 봐</h2><p class="eng">'+esc(f.lead)+' '+(second?'<span class="answered">'+esc(s.answers[s.pos-1])+'</span>':'<span class="slot">___</span>')+esc(f.join)+(second?'<span class="slot">___</span>':'…')+esc(f.end)+'</p>'+options(s.opts),f.alt);
}
function pickFact(v){
  const f=CONTENT.facts[Math.floor(s.pos/2)],slot=s.pos%2?f.b:f.a;s.answers.push(v);
  if(v!==slot.answer)s.misses++;
  if(s.misses>=4){score('summary',labels.summary,false);studyFacts('네 군데를 다시 익혀 보자. 네 문장을 보고 다시 시작해.');return;}
  if(++s.pos<8){showFact();return;}
  score('summary',labels.summary,s.misses===0);
  s.mode='fact-result';
  const mark=(v,slot)=>v===slot.answer?'<span class="right">✓ '+esc(v)+'</span>':'<span class="wrong"><s>'+esc(v)+'</s> → '+esc(slot.answer)+'</span>';
  page.innerHTML=bar('summary',(8-s.misses)+' / 8개')+('<h2>네 문장 확인</h2><ol class="facts">'+CONTENT.facts.map((f,i)=>'<li class="fact-result">'+art(f.art,f.alt)+'<span>'+esc(f.lead)+' '+mark(s.answers[2*i],f.a)+esc(f.join)+mark(s.answers[2*i+1],f.b)+esc(f.end)+'</span></li>').join('')+'</ol><div class="actions">'+button('퀴즈 목록','home')+(s.misses?button('다시 익히기','summary','primary'):'')+'</div>');
}
function vocab(sel){
  cleanup();s={kind:'scene',mode:'words'};const v=CONTENT.vocab[sel];
  page.innerHTML=bar('scene','Lesson 22 · 8단어')+'<div class="tiles">'+CONTENT.vocab.map((w,i)=>'<button class="tile" data-act="word-'+i+'">'+art(w.art)+'<span>'+w.word+'</span></button>').join('')+'</div>'+(v?'<p class="explain"><strong>'+v.word+'</strong>　'+esc(v.en)+'　·　'+esc(v.ko)+'</p>':'')+'<p>'+button('그림 문제 풀기','scenes','primary')+'</p>';
}
function answerSet(value, el) {
  if(s.mode==='test')return pickGap(value);
  if(s.mode==='recall')return pickFact(value);
  if(s.mode==='picture'||s.mode==='motion')return pickImmediate(value,el);
  if(s.mode==='drawers')return pickDrawer(value);
}
function questionVoice(file){play('audio/'+file+'.mp3');}
function pictureScreen(){
  const q=CONTENT.scenes[s.pos];
  s.mode='picture';s.opts=mix([q.answer,...q.foils]);s.answer=q.answer;
  const measures=q.readings?'<div class="readings">'+q.readings.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'';
  page.innerHTML=bar('scene',(s.pos+1)+' / '+CONTENT.scenes.length)+
    '<section class="picture-layout"><figure>'+art(q.art,q.alt)+measures+'</figure><div class="work"><h2>그림과 맞는 문장은?</h2><div class="sentence-options" lang="en">'+options(s.opts)+'</div><p class="feedback" role="status"></p></div></section>';
  questionVoice('sentence-prompt');
}
const motionChoices=['Speed only','Velocity only','Both','Neither'];
function motionScreen(){
  const q=CONTENT.motion[s.deck[s.pos]];
  const speedChanged=q.before[0]!==q.after[0],turned=q.before[1]!==q.after[1];
  s.answer=speedChanged?'Both':turned?'Velocity only':'Neither';
  s.opts=motionChoices.slice();s.mode='motion';
  const directions={east:'→',west:'←',north:'↑',south:'↓'};
  const gauge=(label,val)=>'<div class="gauge"><small>'+label+'</small><strong>'+directions[val[1]]+'</strong><b>'+val[0]+' m/s</b><span>'+val[1]+'</span></div>';
  page.innerHTML=bar('motion',(s.pos+1)+' / '+s.deck.length)+layout('situations-9','<h2>무엇이 달라졌을까?</h2><div class="gauges" lang="en">'+gauge('Before',q.before)+gauge('After',q.after)+'</div>'+options(s.opts)+'<p class="feedback" role="status"></p>');
  questionVoice('motion-prompt');
}
function pickImmediate(value,el){
  const pic=s.mode==='picture';
  const q=pic?CONTENT.scenes[s.pos]:CONTENT.motion[s.deck[s.pos]];
  const group=pic?'scene':'motion', id=group+'-v3-'+q.id, label=labels[group]+' · '+(s.pos+1);
  if(value!==s.answer){
    score(id,label,false);el.disabled=true;
    page.querySelector('.feedback').textContent=pic?q.hint:'Speed tells how fast. Velocity includes direction, too.';
    return;
  }
  stopAudio();s.mode='advance';score(id,label,true);el.classList.add('correct-choice');
  page.querySelector('.feedback').textContent=pic?'✓ 그림과 맞아.':'✓ '+(s.answer==='Both'?'A change in speed also changes velocity.':s.answer==='Neither'?'Same speed and same direction.':'Only the direction changed.');
  timer=setTimeout(()=>{
    if(++s.pos<(pic?CONTENT.scenes.length:s.deck.length)){if(pic)pictureScreen();else motionScreen();}
    else finish(pic?'여덟 장면을 모두 맞혔어.':'속력과 속도를 구별했어.');
  },1150);
}
function rewindStudy(){
  cleanup();s={kind:'rewind',mode:'story-study',round:0};
  page.innerHTML=bar('rewind','문학 · The player on the river')+'<h2>미나의 강가에서</h2><div class="story-strip">'+CONTENT.story.map((v,i)=>'<figure>'+art(v.art)+'<figcaption><small>'+(i+1)+'</small>'+esc(v.line)+'</figcaption></figure>').join('')+'</div><div class="actions">'+button('이야기 되감기','rewind-go','primary')+'</div>';
}
function rewindRound(){
  stopAudio();s.picked=[];s.mode='rewind';rewindStep();
}
function rewindStep(){
  const q=CONTENT.rewinds[s.round], step=s.picked.length;
  const offered=mix(q.choices[step].filter(i=>!s.picked.includes(i))).slice(0,3);
  if(!offered.includes(q.previous[step]))offered[2]=q.previous[step];
  s.offered=mix(offered);
  const anchor=step?CONTENT.story[s.picked[0]].line:q.end;
  page.innerHTML=bar('rewind',(s.round+1)+' / '+CONTENT.rewinds.length+' 이야기 · '+(step+1)+' / 2장면')+
    '<section class="rewind-prompt"><span>'+ (step?'방금 고른 장면':'마지막 장면')+'</span><p lang="en">'+esc(anchor)+'</p></section><h2>바로 전에는 무슨 일이 있었을까?</h2><div class="story-choices">'+s.offered.map(i=>{const v=CONTENT.story[i];return '<button data-act="event-'+i+'">'+art(v.art)+'<span lang="en">'+esc(v.line)+'</span></button>';}).join('')+'</div>';
}
function pickEvent(i){
  if(s.mode!=='rewind'||!s.offered.includes(i))return;
  s.picked.push(i);
  if(s.picked.length<2){rewindStep();return;}
  const q=CONTENT.rewinds[s.round];const good=q.previous.every((x,j)=>s.picked[j]===x);
  score('rewind-v3-'+q.id,labels.rewind+' · '+(s.round+1),good);
  s.mode='story-review';
  const timeline=[...q.previous].reverse().map(i=>({...CONTENT.story[i],audio:'story-'+i}));
  timeline.push({art:q.id==='wait'?'memory-8':null,line:q.end,audio:'end-'+q.id});
  const marks=s.picked.map((x,j)=>{const ok=x===q.previous[j];return '<div class="'+(ok?'right':'wrong')+'">'+(ok?'✓ ':'✕ ')+esc(CONTENT.story[x].line)+'</div>';});
  page.innerHTML=bar('rewind','장면 확인')+'<h2>'+ (good?'두 장면이 이어졌어.':'시간 순서로 다시 보자.')+'</h2>'+
    '<div class="story-strip timeline">'+timeline.map(v=>'<figure>'+(v.art?art(v.art):'<div class="changed-mind">'+art('memory-7','미나가 떠올린 소년')+art('memory-9','미나가 본 뱃사공')+'</div>')+'<figcaption lang="en">'+esc(v.line)+'</figcaption></figure>').join('')+'</div>'+
    (good?'':'<details><summary>내가 고른 순서</summary>'+marks.join('')+'</details>')+'<div class="actions">'+button('다시 재생','play-timeline')+button(good?(s.round+1===CONTENT.rewinds.length?'마치기':'다음 이야기'):'다시 잇기',good?'rewind-next':'rewind-go','primary')+'</div>';
  s.timeline=timeline;playTimeline(0);
}
function playTimeline(i){
  clearTimeout(timer);stopAudio();if(s.mode!=='story-review'||i>=s.timeline.length)return;
  page.querySelectorAll('.timeline figure').forEach((el,n)=>el.classList.toggle('playing',i===n));
  play('audio/'+s.timeline[i].audio+'.mp3',null,()=>playTimeline(i+1),()=>{timer=setTimeout(()=>playTimeline(i+1),1100);});
}
const drawerLabels=['Same species','Same genus, different species','Different genera'];
function drawerStart(){
  cleanup();s={kind:'drawers',mode:'drawers',pos:0,picks:[]};
  s.deck=mix(CONTENT.taxa.map(group=>mix(group)[0]));
  drawerScreen();
}
function drawerAnswer(pair){
  if(pair[0]===pair[1])return drawerLabels[0];
  return pair[0].split(' ')[0]===pair[1].split(' ')[0]?drawerLabels[1]:drawerLabels[2];
}
function drawerScreen(){
  const pair=s.deck[s.pos];s.mode='drawers';s.opts=drawerLabels.slice();
  page.innerHTML=bar('drawers',(s.pos+1)+' / '+s.deck.length)+'<section class="drawer-board"><h2>두 이름표는 어느 서랍에 넣을까?</h2><div class="specimens">'+
    pair.map((name,i)=>'<div class="specimen"><small>Specimen '+(i?'B':'A')+'</small><i lang="la">'+esc(name)+'</i></div>').join('')+'</div><div class="drawers">'+options(s.opts)+'</div></section>';
  questionVoice('drawers-prompt');
}
function pickDrawer(v){
  s.picks.push(v);
  if(++s.pos<s.deck.length){drawerScreen();return;}
  stopAudio();s.mode='drawer-review';
  let misses=[];
  const rows=s.deck.map((pair,i)=>{
    const a=drawerAnswer(pair),ok=s.picks[i]===a;
    if(!ok)misses.push(pair);
    const id=pair.slice().sort().join('-');score('taxa-v3-'+id,labels.drawers+' · '+pair.join(' / '),ok);
    const why=a===drawerLabels[0]?'Both parts match.':a===drawerLabels[1]?'Only the first word matches.':'The first words name different genera.';
    return '<li><i>'+pair.map(esc).join(' · ')+'</i><div class="'+(ok?'right':'wrong')+'">'+(ok?'✓ ':'✕ '+esc(s.picks[i])+' → ')+esc(a)+'</div><small>'+why+'</small></li>';
  });
  page.innerHTML=bar('drawers',(s.deck.length-misses.length)+' / '+s.deck.length)+'<h2>이름표 정리</h2><ul class="sorting-results">'+rows.join('')+'</ul><div class="actions">'+button('퀴즈 목록','home')+(misses.length?button('틀린 이름표 다시 분류','drawers-retry','primary'):button('다른 이름표로 한 판','drawers','primary'))+'</div>';
  s.misses=misses;
}

const starts={listen:()=>passageStart(),summary:()=>studyFacts(),scene:()=>vocab(),motion:()=>{cleanup();s={kind:'motion',pos:0,deck:CONTENT.motion.map((_,i)=>i)};motionScreen();},rewind:rewindStudy,drawers:drawerStart};
function launch(id){
  window.scrollTo(0,0);
  if(starts[id])starts[id]();else openHome();
}
function navigate(id){
  const hash=id==='home'?'':'#'+id;
  if(location.hash!==hash)history.pushState(null,'',location.pathname+location.search+hash);
  launch(id);
}
window.addEventListener('popstate',()=>launch(location.hash.slice(1)));
document.querySelector('#home').onclick=()=>navigate('home');
document.querySelector('#sum').textContent=total()+'원';
document.querySelector('#bank').onclick=()=>{
  const items=Object.values(ledger).filter(r=>r.solved);
  document.querySelector('#entries').innerHTML='<p>누계 '+total()+'원</p>'+items.map(r=>'<div class="entry">'+esc(r.label)+'<b>+'+Number(r.amount)+'원</b></div>').join('')+'<p class="muted">첫 도전에 맞힌 듣기·기억 세트, 그림·속력 문제, 이야기 한 묶음, 이름표 한 쌍마다 10·12·15원 중 하나를 받아. 같은 항목은 하루 한 번이야.</p>';
  document.querySelector('#ledger').showModal();
};
document.querySelector('#designOpen').onclick=()=>document.querySelector('#design').showModal();
page.onclick=e=>{
  const el=e.target.closest('button[data-act]');if(!el||el.disabled)return;const a=el.dataset.act;
  if(a==='home'||Object.hasOwn(starts,a))return navigate(a);if(a.startsWith('passage-'))return passageStart(+a.slice(8));
  if(a==='narrate')return narrate();if(a==='stop-reading')return endNarration();
  if(a==='begin'&&s.mode==='study'&&s.seen.size>=10)return round(false);if(a==='retry'&&s.mode==='review'&&s.queue.length)return round(true);
  if(a.startsWith('locate-')&&s.mode==='review')return goTo(page.querySelector('[data-line="'+Number(a.slice(7))+'"]'));if(a==='repeat'&&s.mode==='test')return playGap();if(a==='finish-listen')return finish('이 지문의 빈칸을 채웠어.');
  if(a==='recall')return showFact();
  if(a.startsWith('word-'))return vocab(+a.slice(5));if(a==='scenes'){s.pos=0;return pictureScreen();}
  if(a==='rewind-go')return rewindRound();
  if(a.startsWith('event-'))return pickEvent(+a.slice(6));
  if(a==='play-timeline')return playTimeline(0);
  if(a==='rewind-next'){cleanup();if(++s.round<CONTENT.rewinds.length)return rewindRound();return finish('시간 순서로 이야기를 이었어.');}
  if(a==='drawers-retry'){s.deck=s.misses.slice();s.picks=[];s.pos=0;return drawerScreen();}
  if(a.startsWith('pick-'))return answerSet(s.opts[+a.slice(5)],el);
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden||!audio)return;if(s.mode==='study')endNarration();else {stopAudio();const note=page.querySelector('#audioNote');if(note)note.textContent='다시 듣기를 눌러 이어가세요.';}});
launch(location.hash.slice(1));
