'use strict';
const page=document.querySelector('#page'), cash=document.querySelector('#sum'), dialog=document.querySelector('#ledger');
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const storeKey='river-notes-focus:v1:'+day;
let receipts={};try{receipts=JSON.parse(localStorage.getItem(storeKey)||'{}')||{}}catch{}
const total=()=>Object.values(receipts).reduce((s,r)=>s+(r.amount||0),0);
function save(){try{localStorage.setItem(storeKey,JSON.stringify(receipts))}catch{}cash.textContent=total()+'원'}
save();
const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const b=(txt,act,cls='')=>'<button class="'+cls+'" data-act="'+act+'">'+txt+'</button>';
const img=(id,alt='')=>'<img alt="'+alt+'" src="art/'+id+'.webp">';
const labels={listen:'빈칸 듣기',summary:'요약 복원',scene:'상황 단어',extra:'한 걸음 더'};
const keys=Object.keys(labels);let state={},run=0,transition=0,notice=0,raf=0,audio=null,lock=false;
function silence(){cancelAnimationFrame(raf);if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio=null}}
function reset(){clearTimeout(transition);silence();run++;lock=false}
function notify(t){clearTimeout(notice);const el=document.querySelector('#toast');el.textContent=t;notice=setTimeout(()=>el.textContent='',1850)}
function award(id,label){let r=receipts[id];if(r?.solved){notify('✓ 다시 풀었어');return}if(!r){let n=Math.random();r={amount:n<.65?10:n<.9?12:15}}r.label=label;r.solved=true;receipts[id]=r;save();notify(r.amount?'✓ 정답　+'+r.amount+'원':'✓ 다시 생각해서 맞혔어')}
function miss(id,label){if(!(id in receipts)){receipts[id]={amount:0,label,solved:false};save()}}
function later(fn){lock=true;const token=run;transition=setTimeout(()=>{if(token===run){lock=false;fn()}},650)}
const framing=(title,progress,inner)=>'<div class="bar"><h1>'+title+'</h1><small>'+progress+'</small></div>'+inner;
const panel=(art,caption,body)=>'<section class="panel"><div class="illustration">'+img(art,caption)+'<small>'+caption+'</small></div><div class="work">'+body+'</div></section>';
function home(){reset();state={};page.innerHTML='<section class="hero"><div><small class="k" style="color:#c4e2ce">RIVER NOTES　/　CLASS 12</small><h1>집중력 퀴즈</h1><p>한 소절을 듣고, 장면을 기억하고,<br>내가 배운 단어를 꺼내 보자.</p></div><div class="panorama">'+img('r3','강 위의 피리 연주자')+img('m1','강가의 장터')+'</div></section><div class="cards">'+[
 ['listen','r2','귀로 찾는 빈칸','문학·과학　·　3라운드'],['summary','r4','기억으로 잇는 네 문장','문학　·　4문장'],['scene','m8','그림 속 여덟 단어','Lesson 22　·　3장면']].map(([a,i,t,p])=>'<button class="card" data-act="'+a+'">'+img(i)+'<div><strong>'+t+'</strong><small>'+p+'</small></div></button>').join('')+'</div><div class="smallrow row">'+b('근거 탐정 · 새 그림에 적용 →','extra')+'</div><details class="help"><summary>출제와 모의 보상 기준</summary><p>11/22 숙제 기획의 문학 The Boatman’s Flute, 과학 Topic 10 Lesson 2, Vocabulary Essential 3 Lesson 22를 바탕으로 새로 쓴 영어 연습입니다.</p><p>듣기는 줄거리의 원인·행동과 과학 분류 개념을 먼저 뽑고, 시간·장소 단서도 섞어요. 장면당 한 칸만 비우고 같은 종류의 보기 4개를 섞습니다. 요약은 역할이 비슷한 단어끼리, 상황은 같은 장면의 서로 다른 행동끼리 구분해요.</p><p>첫 시도에 맞힌 듣기 한 장면·요약 한 문장·상황 한 빈칸·추가 게임 한 문제당 기본 10원. 65%는 10원, 25%는 12원, 10%는 15원입니다. 카드를 낱개로 조립할 때는 문장 전체가 맞아야 한 번 지급합니다. 오늘 같은 항목은 다시 맞혀도 추가 지급되지 않아요. 틀려도 이미 모은 금액은 유지됩니다. 이 브라우저의 모의 통장입니다.</p></details>'}
function start(kind){reset();state={kind,i:0,pos:1,hint:'',done:new Set(),slot:0};
 if(kind==='listen'){state.deck=shuffle(LESSON.reads).map(r=>{const n=Math.random()*r.targets.reduce((a,t)=>a+t.weight,0);return {r,t:n<r.targets[0].weight?r.targets[0]:r.targets[1]}});readIntro()}
 if(kind==='summary')summaryIntro();
 if(kind==='scene')studyWords();
 if(kind==='extra'){state.deck=shuffle(LESSON.more);extra()}
}
function finish(){reset();page.innerHTML='<div class="done">'+img('r8','두 개구리의 특징 비교')+'<h2>'+labels[state.kind]+' 완료</h2><p>오늘 모은 모의 보상　<b>'+total()+'원</b></p>'+b('퀴즈 목록','home','primary')+'</div>'}
function readIntro(){silence();const {r}=state.deck[state.i];page.innerHTML=framing(labels.listen,(state.i+1)+' / 3',panel(r.art,r.title,'<small class="k">READ FIRST</small><h2>'+r.title+'</h2><p class="english" lang="en">'+r.lines.join(' ')+'</p>'+b('읽었어 · 듣기 시작','hear','primary')))}
function choices(list){return '<div class="choices">'+list.map((x,i)=>b(x,'c'+i,'choice')).join('')+'</div><div id="feedback" role="status"></div>'}
function playMask(){silence();const {r,t}=state.deck[state.i];state.options=shuffle([t.word,...t.others]);state.answer=t.word;state.key='listen-'+r.id;state.hint=t.why;state.ready=false;
 page.innerHTML=framing(labels.listen,(state.i+1)+' / 3',panel(r.art,r.title,'<small class="k">'+t.group+'</small><h2>들리지 않는 말은?</h2><p id="track" class="lines" lang="en">'+t.timing.map(([w])=>'<span class="word '+(w==='____'?'slot':'')+'">'+w+'</span>').join(' ')+'</p><div id="picks"></div>'+b('↻ 다시 듣기','hear')));
 const nodes=[...document.querySelectorAll('#track span')];const a=audio=new Audio(t.audio);let idx=0;
 function reveal(end=false){if(a!==audio)return;while(idx<nodes.length&&(end||a.currentTime>=t.timing[idx][1]))nodes[idx++].classList.add('show');if(end){state.ready=true;document.querySelector('#picks').innerHTML=choices(state.options)}else raf=requestAnimationFrame(()=>reveal())}
 a.onended=()=>{cancelAnimationFrame(raf);reveal(true)};a.onerror=()=>{cancelAnimationFrame(raf);reveal(true);notify('음원을 열 수 없어 글로 진행합니다')};a.play().then(()=>{if(a===audio)reveal()}).catch(()=>{if(a===audio)a.onerror()})
}
function summaryIntro(){page.innerHTML=framing(labels.summary,'먼저 네 문장을 읽어 봐',panel('r6','강가의 음악을 떠올리는 장면','<h2>강에서 있었던 일</h2><div class="stack">'+LESSON.summary.map(([s])=>'<div>'+s+'</div>').join('')+'</div><p>'+b('카드로 복원하기','restore','primary')+'</p>'))}
function clean(w){return w.replace(/[.,!?]/g,'')}
function summary(){const [line,clue,art,roles]=LESSON.summary[state.i], words=line.split(' ').map(clean),pos=state.pos,role=roles[pos];
 const groups={past:['heard','waited','sailed'],det:['that','her','their'],noun:['water','river','music','window'],adj:['empty','quiet','distant'],adv:['nearby','outside','upstairs'],prep:['from','with','by']};
 const others=LESSON.summary.flatMap(([s,,,g])=>s.split(' ').map(clean).filter((_,i)=>g[i]===role));
 state.answer=words[pos];state.options=shuffle([state.answer,...shuffle([...new Set([...others,...groups[role]])].filter(x=>x!==state.answer)).slice(0,3)]);state.key='summary-'+state.i;state.hint=clue+'을 떠올려 봐. 이번 자리는 '+({past:'일어난 행동',det:'다음 낱말을 가리키는 말',noun:'사물이나 사람',adj:'모습을 나타내는 말',adv:'움직인 방향',prep:'두 말을 잇는 말'})[role]+'이야.';
 page.innerHTML=framing(labels.summary,(state.i+1)+' / 4',panel(art,clue,'<small class="k">STORY MEMORY</small><h2>'+clue+'</h2><p class="english"><span class="stored">'+words.slice(0,pos).join(' ')+'</span> <span class="slot">…</span></p>'+choices(state.options)+b('네 문장 다시 보기','peek','compact')))}
function studyWords(sel=-1){const v=LESSON.vocab[sel];page.innerHTML=framing('Lesson 22 · 장면에 쓸 단어','8단어','<div class="tiles">'+LESSON.vocab.map(([word,,en,art],i)=>'<button class="tile '+(i===sel?'on':'')+'" data-act="v'+i+'">'+img(art)+'<strong>'+word+'</strong>'+(i===sel?'':'<small>'+en+'</small>')+'</button>').join('')+'</div>'+(v?'<p class="explain"><b>'+v[0]+'</b>　'+v[2]+'　·　'+v[1]+'</p>':'')+'<p>'+b('그림 문제로 →','scenes','primary')+'</p>')}
function scenes(){const [title,art,rows]=LESSON.scenes[state.i];if(!state.pool)state.pool=shuffle(LESSON.vocab.map(v=>v[0]));const row=rows[state.slot];state.options=state.pool;state.answer=row[0];state.key='scene-'+row[0];state.hint=row[2];
 page.innerHTML=framing(labels.scene,(state.i+1)+' / 3',panel(art,title,'<small class="k">ONE SCENE · MANY WORDS</small><h2>'+title+'</h2>'+rows.map(([w,line],i)=>'<button class="sentence '+(state.done.has(i)?'solved':state.slot===i?'sel':'')+'" '+(state.done.has(i)?'disabled':'data-act="s'+i+'"')+'>'+line.replace('___',state.done.has(i)?'<b>'+w+'</b>':'<span class="slot">'+(i+1)+'</span>')+'</button>').join('')+choices(state.options)))}
function extra(){const q=state.deck[state.i];state.options=shuffle(q.choices);state.answer=q.a;state.key='extra-'+q.id;state.hint=q.hint;
 page.innerHTML=framing(q.title,(state.i+1)+' / 2',panel(q.art,q.title,'<small class="k">FIELD CHALLENGE</small><p class="english">'+q.q+'</p>'+choices(state.options)))}
function answer(i){if(lock||!state.options||state.options[i]===undefined||state.kind==='listen'&&!state.ready)return;
 const key=state.key,label=labels[state.kind]+' · '+(state.i+1)+(state.kind==='scene'?' / '+(state.slot+1):'');
 if(state.options[i]!==state.answer){miss(key,label);document.querySelector('[data-act=c'+i+']').disabled=true;const f=document.getElementById('feedback');f.className='explain';f.textContent=state.hint;return}
 if(state.kind==='summary'&&state.pos+1<LESSON.summary[state.i][0].split(' ').length){state.pos++;summary();return}
 award(key,label);
 if(state.kind==='summary'){document.querySelector('.english').textContent=LESSON.summary[state.i][0];later(()=>{state.pos=1;if(++state.i===4)finish();else summary()})}
 if(state.kind==='listen')later(()=>{if(++state.i===state.deck.length)finish();else readIntro()});
 if(state.kind==='extra')later(()=>{if(++state.i===state.deck.length)finish();else extra()});
 if(state.kind==='scene'){state.done.add(state.slot);const n=LESSON.scenes[state.i][2].length;let next=Array.from({length:n},(_,i)=>i).find(i=>!state.done.has(i));if(next!==undefined){state.slot=next;scenes()}else{scenes();later(()=>{state.done.clear();state.slot=0;state.pool=null;if(++state.i===3)finish();else scenes()})}}
}
document.querySelector('#home').onclick=home;
document.querySelector('#bank').onclick=()=>{const rows=Object.values(receipts).filter(r=>r.solved);document.querySelector('#entries').innerHTML='<p>누계 <b>'+total()+'원</b></p>'+rows.reverse().map(r=>'<div class="entry">'+r.label+'<b>+'+r.amount+'원</b></div>').join('')+(rows.length?'':'아직 받은 보상이 없어요.');dialog.showModal()};
page.onclick=e=>{const a=e.target.closest('[data-act]')?.dataset.act;if(!a||lock)return;
 if(a==='home')return home();if(keys.includes(a))return start(a);
 if(a==='hear')return playMask();if(a==='restore')return summary();
 if(a==='peek'){miss(state.key,labels.summary+' · '+(state.i+1));summaryIntro();return}
 if(a==='scenes')return scenes();if(/^v\d+$/.test(a))return studyWords(+a.slice(1));if(/^s\d+$/.test(a)){state.slot=+a.slice(1);return scenes()}if(/^c\d+$/.test(a))answer(+a.slice(1))};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio&&!audio.paused){silence();notify('돌아오면 다시 듣기를 눌러 주세요.')}});
home();
