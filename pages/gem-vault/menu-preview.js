'use strict';

const previewRates=[.75,.85,1,1.1,1.25,1.5];

function preferences(){
 return current().viewPreferences??={zoom:100,spread:false,en:.85,ko:1.1};
}
function applyViewSettings(){
 const prefs=preferences();
 $('study').style.setProperty('--zoom',prefs.zoom/100);
 $('samplePage').classList.toggle('spread',prefs.spread);
}
function restSeconds(){
 const state=current(),initial=state.restSeconds??(data.child==='seoa'?750:480);
 const elapsed=state.restReason==='쉬기'&&state.restStarted?Math.floor((Date.now()-state.restStarted)/1000):0;
 return Math.max(0,initial-Math.max(0,elapsed));
}
function restLabel(){
 const seconds=restSeconds();
 return Math.floor(seconds/60)+'분'+(seconds%60?' '+(seconds%60)+'초':'');
}
function updateRestClock(){
 const label=restLabel();
 $('restBalance').textContent=label;
 $('rest').setAttribute('aria-label','모은 쉬는 시간 '+label+' · 쉬는 시간 메뉴');
 const hint=$('popBody').querySelector('[data-rest-remaining]');if(hint)hint.textContent=label;
}
function setRest(reason){
 closeReward();cancelGem();closePopup();
 const state=current();state.restSeconds=restSeconds();state.restStarted=reason==='쉬기'?Date.now():0;
 state.restReason=reason;save();hud();
 (reason?$('resume'):$('rest')).focus({preventScroll:true});
}
function renderRestChoices(){
 if(current().restReason){row('다시하기',()=>setRest(''));return;}
 const choices=document.createElement('div');choices.className='pauseChoices';
 for(const [reason,detail] of [['쉬기',restLabel()],['화장실','5분'],['밥','45분'],['학원',''],['잠자기+학교','']]){
  const b=document.createElement('button');b.textContent=reason;b.onclick=()=>setRest(reason);
  if(detail){const small=document.createElement('small');small.textContent=detail;if(reason==='쉬기')small.dataset.restRemaining='';b.append(small);}
  choices.append(b);
 }
 $('popBody').append(choices);
}
function menuControl(parent,label,action,icon){
 const b=document.createElement('button');b.type='button';b.textContent=label;
 if(icon){const mark=document.createElement('span');mark.ariaHidden='true';mark.textContent=icon;b.prepend(mark);}
 b.disabled=!action;if(action)b.onclick=action;parent.append(b);return b;
}
function renderViewMenu(){
 const surface=$('surface').value,prefs=preferences(),body=$('popBody');
 const tools=document.createElement('div');tools.className='viewTools';body.append(tools);
 if(surface==='home'){
  for(const name of ['책 카메라 보기','학생 카메라'])menuControl(tools,name,()=>{
   closePopup();toast(name+' · 카메라 연결 미리보기');
  },'◉');
  return;
 }
 const strip=document.createElement('div');strip.className='viewStrip';body.append(strip);strip.append(tools);
 const book=surface==='book';
 const returnBook=surface==='activity'&&data.child==='seoin';
 menuControl(tools,returnBook?'교재로 돌아가기':'숙제 목록',()=>changeSurface(returnBook?'book':'home'),'☷');
 const spread=menuControl(tools,'한 쪽 / 두 쪽',book?()=>{
  prefs.spread=!prefs.spread;save();applyViewSettings();spread.setAttribute('aria-pressed',String(prefs.spread));
 }:null,'◫');spread.title='한 쪽 / 두 쪽 보기';spread.setAttribute('aria-pressed',String(book&&prefs.spread));
 menuControl(tools,'교재 사진',null,'▧');
 menuControl(tools,'읽기 도움',book?()=>{closePopup();toast('beneath the leaves · 나뭇잎 아래에');}:null,'?');
 const zoom=document.createElement('div');zoom.className='zoomLine';strip.append(zoom);
 const caption=document.createElement('b');caption.textContent='본문 크기';zoom.append(caption);
 const setZoom=value=>{prefs.zoom=value;save();applyViewSettings();reset.textContent=value+'%';minus.disabled=value<=80;plus.disabled=value>=150;};
 const minus=menuControl(zoom,'−',()=>setZoom(prefs.zoom-10));minus.ariaLabel='본문 작게';
 const reset=menuControl(zoom,'',()=>setZoom(100));reset.ariaLabel='본문 크기 초기화';
 const plus=menuControl(zoom,'+',()=>setZoom(prefs.zoom+10));plus.ariaLabel='본문 크게';
 reset.textContent=prefs.zoom+'%';minus.disabled=prefs.zoom<=80;plus.disabled=prefs.zoom>=150;
 const rates=document.createElement('div');rates.className='rateLine';strip.append(rates);
 for(const [lang,label] of [['en','영어'],['ko','한국어']]){
  const wrap=document.createElement('label'),select=document.createElement('select');
  wrap.append(label+' ',select);select.ariaLabel=label+' 재생 속도';
  for(const rate of previewRates)select.add(new Option(rate+'×',String(rate)));
  select.value=String(prefs[lang]);select.onchange=()=>{prefs[lang]=Number(select.value);save();};
  rates.append(wrap);
 }
}
