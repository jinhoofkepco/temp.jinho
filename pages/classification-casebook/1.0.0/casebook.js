const casebookSpecimens={"a": {"legs": [[29.8, 21.7], [42.2, 12.4], [61.2, 10.2], [78.5, 15.9], [30.0, 79.5], [43.2, 87.8], [61.2, 91.2], [78.5, 85.1]], "body": [[55.1, 49.8], [76.6, 50.0]], "pincers": [[22.4, 34.1], [22.2, 66.6]], "tail": [[88.3, 50.5]]}, "b": {"legs": [[22.9, 24.9], [36.6, 14.9], [53.2, 13.2], [67.3, 18.5], [22.9, 77.6], [34.1, 86.8], [52.2, 90.2], [68.3, 84.6]], "body": [[45.9, 50.2], [63.4, 50.5]], "pincers": [[17.1, 34.6], [17.1, 66.3]], "tail": [[72.7, 51.0], [76.3, 51.0], [82.4, 49.5], [88.3, 45.4], [91.7, 40.2], [93.7, 34.6], [93.2, 27.6], [90.0, 23.2], [85.9, 23.4], [80.5, 26.1]]}};
const casebookTerms=["species", "classification", "genus", "binomial nomenclature", "taxonomy", "domain", "evolution", "convergent evolution", "determine"];
((scope) => {
  function createScienceKeywords(root, terms) {
    const doc = root.ownerDocument || root;
    const filters = doc.defaultView.NodeFilter;
    const readingSelector = '[data-science-reading]';
    const exclude = 'a, button, script, style, textarea, select, option, svg, math, [aria-hidden="true"], [data-sci-keyword], [data-keyword-controls]';
    const uniqueTerms = [...new Set(terms.map(term => term.trim()).filter(Boolean))];
    const escaped = uniqueTerms.sort((a, b) => b.length - a.length).map(term =>
      term.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    const matchKeyword = escaped.length ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped.join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null;
    let hidden = false;
    let control = null;
    let occurrences = [];

    function display({wrapper, word}, index) {
      if (!hidden) {
        const mark = doc.createElement('mark');
        mark.className = 'sci-keyword-mark';
        mark.textContent = word;
        wrapper.replaceChildren(mark);
        return;
      }
      const blank = doc.createElement('button');
      blank.type = 'button';
      blank.className = 'sci-keyword-blank';
      blank.textContent = '____';
      blank.setAttribute('aria-label', `가린 영어 단어 ${index + 1}번 보기`);
      blank.addEventListener('click', event => {
        event.stopPropagation();
        if (blank.hasAttribute('aria-disabled')) return;
        blank.textContent = word;
        blank.lang = 'en';
        blank.removeAttribute('aria-label');
        blank.setAttribute('aria-disabled', 'true');
        blank.classList.add('is-revealed');
      });
      wrapper.replaceChildren(blank);
    }

    function showMode() {
      const mode = hidden ? 'hidden' : 'visible';
      root.setAttribute('data-keyword-mode', mode);
      if (control) control.setAttribute('aria-pressed', String(hidden));
    }

    function updateControl() {
      const toolbar = root.querySelector('[data-keyword-controls]');
      if (!toolbar || toolbar.contains(control)) return;
      control = doc.createElement('button');
      control.type = 'button';
      control.className = 'sci-keyword-toggle';
      control.setAttribute('data-keyword-toggle', '');
      control.textContent = '핵심 단어 가리기';
      control.addEventListener('click', event => {
        event.stopPropagation();
        setHidden(!hidden);
      });
      toolbar.append(control);
    }

    function refresh() {
      updateControl();
      showMode();
      if (!matchKeyword) return;
      occurrences = occurrences.filter(({wrapper}) => root.contains(wrapper));
      for (const region of root.querySelectorAll(readingSelector)) {
        const walk = doc.createTreeWalker(region, filters.SHOW_TEXT, {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent || parent.closest(exclude) || parent.closest(readingSelector) !== region) return filters.FILTER_REJECT;
            const languageTag = parent.closest('[lang]');
            if (languageTag && region.contains(languageTag) && !/^en(?:-|$)/i.test(languageTag.lang)) return filters.FILTER_REJECT;
            return filters.FILTER_ACCEPT;
          }
        });
        const nodes = [];
        while (walk.nextNode()) nodes.push(walk.currentNode);
        for (const node of nodes) {
          let cursor = 0;
          let fragment;
          for (const match of node.data.matchAll(matchKeyword)) {
            fragment ||= doc.createDocumentFragment();
            const start = match.index + match[1].length;
            const word = match[2];
            const wrapper = doc.createElement('span');
            wrapper.className = 'sci-keyword';
            wrapper.setAttribute('data-sci-keyword', '');
            fragment.append(node.data.slice(cursor, start), wrapper);
            const occurrence = {wrapper, word};
            display(occurrence, occurrences.length);
            occurrences.push(occurrence);
            cursor = start + word.length;
          }
          if (fragment) {
            fragment.append(node.data.slice(cursor));
            node.replaceWith(fragment);
          }
        }
      }
    }

    function setHidden(value) {
      hidden = Boolean(value);
      refresh();
      occurrences.forEach(display);
    }

    refresh();
    return {refresh, setHidden};
  }

  scope.createScienceKeywords = createScienceKeywords;
})(globalThis);

(() => {
  const start = [50, 7];
  const gates = [
    {at: [50, 21], take: ['1a', 'Has 8 legs'], other: ['1b', 'Has more than 8 legs'], next: 2},
    {at: [50, 35], take: ['2b', 'Has two body regions'], other: ['2a', 'Has one oval-shaped body region'], next: 5},
    {at: [50, 49], take: ['5a', 'Has clawlike pincers'], other: ['5b', 'Has no clawlike pincers'], next: 6}
  ];
  const fork = [50, 63];
  const specimens = {
    a: {at: [25, 80], number: '6b', feature: 'Has no tail or stinger', name: 'Pseudoscorpion'},
    b: {at: [75, 80], number: '6a', feature: 'Has a long tail with a stinger', name: 'Scorpion'}
  };
  const imageSrc = (base, id) => `${base}revision-specimen-${id}.webp`;
  const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const position = ([x, y]) => `--mk-x:${x}%;--mk-y:${y}%`;

  function traceTail(points) {
    if (!points?.length) return '';
    const lines = points.slice(1).map(([x, y], i) => {
      const [fromX, fromY] = points[i];
      const dx = x - fromX;
      const dy = y - fromY;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return `<i class="mk-tail-trace" style="${position(points[i])};--mk-width:${Math.hypot(dx, dy)}%;--mk-angle:${angle}deg;--mk-delay:${i * 70}ms"></i>`;
    });
    return `${lines.join('')}<i class="mk-tail-tip" style="${position(points.at(-1))};--mk-delay:${lines.length * 70}ms"></i>`;
  }

  function renderMotionKey(assetBase = './assets/', featurePoints = typeof specimenPoints === 'undefined' ? null : specimenPoints) {
    return `<section class="motion-key" data-motion-key aria-label="455쪽 검색표 그림">
      <div class="mk-controls" role="group" aria-label="표본과 재생">
        <button type="button" data-mk-specimen="a" aria-pressed="true">표본 A</button>
        <button type="button" data-mk-specimen="b" aria-pressed="false">표본 B</button>
        <button type="button" data-mk-play>재생</button>
        <button type="button" data-mk-back aria-label="이전 갈림길" disabled>‹</button>
        <button type="button" data-mk-next aria-label="다음 갈림길">›</button>
      </div>
      <div class="mk-map" aria-hidden="true" lang="en">
        <span class="mk-main-line"></span>
        <span class="mk-traveled" data-mk-traveled></span>
        <span class="mk-fork-line"></span>
        <span class="mk-branch mk-branch-a"></span>
        <span class="mk-branch mk-branch-b"></span>
        ${gates.map(({at, take, other}, i) => `<div class="mk-gate" data-mk-gate="${i + 1}" style="${position(at)}">
          <span class="mk-take"><b>${take[0]}</b> ${take[1]}</span><i class="mk-dot"></i>
          <span class="mk-other"><b>${other[0]}</b> ${other[1]}</span>
        </div>`).join('')}
        <span class="mk-split mk-dot" data-mk-gate="4">6</span>
        ${Object.entries(specimens).map(([id, specimen]) => `<span class="mk-end" data-mk-end="${id}" style="${position(specimen.at)}">
          <i class="mk-dot"></i><span class="mk-end-label"><b>${specimen.number}</b> ${specimen.name}</span></span>`).join('')}
        <img class="mk-token" data-mk-token src="${escapeAttribute(imageSrc(assetBase, 'a'))}" data-mk-a="${escapeAttribute(imageSrc(assetBase, 'a'))}" data-mk-b="${escapeAttribute(imageSrc(assetBase, 'b'))}" alt="">
      </div>
      <p class="mk-status" data-mk-status role="status" lang="en">Specimen A · Start at Step 1.</p>
      <div class="mk-compare" data-mk-compare hidden lang="en">
        ${Object.entries(specimens).map(([id, specimen]) => `<figure class="mk-model" data-mk-model="${id}">
          <div class="mk-diagram">
            <img src="${escapeAttribute(imageSrc(assetBase, id))}" alt="Specimen ${id.toUpperCase()}, viewed from above." width="410" height="410">
            <span class="mk-trace" aria-hidden="true">${traceTail(featurePoints?.[id]?.tail)}</span>
          </div>
          <figcaption><b>${specimen.number}</b> ${specimen.feature}</figcaption>
        </figure>`).join('')}
      </div>
    </section>`;
  }

  function mountMotionKey(root) {
    const elements = root.matches('[data-motion-key]') ? [root] : root.querySelectorAll('[data-motion-key]');
    for (const element of elements) {
      if (element.hasAttribute('data-mk-ready')) continue;
      element.setAttribute('data-mk-ready', '');
      const token = element.querySelector('[data-mk-token]');
      const status = element.querySelector('[data-mk-status]');
      const progress = element.querySelector('[data-mk-traveled]');
      const play = element.querySelector('[data-mk-play]');
      const back = element.querySelector('[data-mk-back]');
      const next = element.querySelector('[data-mk-next]');
      const compare = element.querySelector('[data-mk-compare]');
      const models = [...element.querySelectorAll('[data-mk-model]')];
      const endpoints = [...element.querySelectorAll('[data-mk-end]')];
      const gateNodes = [...element.querySelectorAll('[data-mk-gate]')];
      const specimenButtons = [...element.querySelectorAll('[data-mk-specimen]')];
      const reduce = element.ownerDocument.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)');
      const last = gates.length + 2;
      let specimen = 'a';
      let stage = 0;
      let timer;
      let animation;
      let playing = false;

      function points() {
        return [start, ...gates.map(gate => gate.at), fork, specimens[specimen].at];
      }

      function syncControls() {
        play.textContent = playing ? '멈춤' : stage === last ? '다시 보기' : stage || animation ? '이어서 재생' : '재생';
        element.toggleAttribute('data-mk-moving', playing || animation?.playState === 'running');
        back.disabled = stage === 0 && !animation;
        next.disabled = stage === last;
      }

      function present() {
        const name = specimen.toUpperCase();
        const gate = gates[stage - 1];
        const answer = specimens[specimen];
        const [x, y] = points()[stage];
        token.style.left = `${x}%`;
        token.style.top = `${y}%`;
        progress.style.height = `${Math.min(y, fork[1]) - start[1]}%`;
        element.dataset.mkStage = String(stage);
        element.dataset.mkActive = specimen;
        gateNodes.forEach(node => node.classList.toggle('mk-visited', +node.dataset.mkGate <= stage));
        endpoints.forEach(node => node.classList.toggle('mk-arrived', stage === last && node.dataset.mkEnd === specimen));
        models.forEach(model => model.classList.toggle('mk-chosen', stage === last && model.dataset.mkModel === specimen));
        compare.hidden = stage < last - 1;
        if (!stage) status.textContent = `Specimen ${name} · Start at Step 1.`;
        else if (gate) status.textContent = `${gate.take[0]} · ${gate.take[1]}. Go to Step ${gate.next}.`;
        else if (stage < last) status.textContent = 'Step 6 · Look at the end of each body. Does it have a tail and a stinger?';
        else status.textContent = `${answer.number} · ${answer.feature}. Specimen ${name} is a ${answer.name.toLowerCase()}.`;
        syncControls();
      }

      function schedule() {
        if (!playing) return;
        if (stage === last) {
          playing = false;
          syncControls();
          return;
        }
        timer = setTimeout(() => go(stage + 1), stage === last - 1 ? 2100 : 1250);
      }

      function pause() {
        playing = false;
        clearTimeout(timer);
        animation?.pause();
        syncControls();
      }

      function abortAnimation() {
        if (!animation) return;
        animation.onfinish = null;
        animation.cancel();
        animation = null;
      }

      function go(to) {
        element.dispatchEvent(new Event('science-motion-start'));
        abortAnimation();
        const track = points();
        const from = track[stage];
        const target = track[to];
        const frame = ([x, y]) => ({left: `${x}%`, top: `${y}%`});
        function arrive() {
          abortAnimation();
          stage = to;
          present();
          schedule();
        }
        if (reduce?.matches || typeof token.animate !== 'function') {
          arrive();
          return;
        }
        const frames = [frame(from)];
        if (to === last) frames.push(frame([target[0], from[1]]));
        if (stage === last) frames.push(frame([from[0], target[1]]));
        frames.push(frame(target));
        animation = token.animate(frames, {duration: frames.length === 3 ? 1100 : 740, easing: 'ease-in-out', fill: 'both'});
        animation.onfinish = arrive;
        syncControls();
      }

      specimenButtons.forEach(button => button.addEventListener('click', () => {
        const chosen = button.dataset.mkSpecimen;
        if (chosen === specimen) return;
        pause();
        abortAnimation();
        specimen = chosen;
        stage = 0;
        token.src = token.dataset[`mk${specimen.toUpperCase()}`];
        specimenButtons.forEach(option => option.setAttribute('aria-pressed', String(button === option)));
        present();
      }));
      back.addEventListener('click', () => {
        pause();
        if (animation) {
          abortAnimation();
          present();
        } else {
          go(stage - 1);
        }
      });
      next.addEventListener('click', () => { pause(); go(stage + 1); });
      play.addEventListener('click', () => {
        if (playing) { pause(); return; }
        if (stage === last) { stage = 0; present(); }
        playing = true;
        if (animation) {
          element.dispatchEvent(new Event('science-motion-start'));
          animation.play();
        }
        else go(stage + 1);
        syncControls();
      });
      element.addEventListener('science-motion-pause', pause);
      present();
    }
  }

  globalThis.renderMotionKey = renderMotionKey;
  globalThis.mountMotionKey = mountMotionKey;
})();

(() => {
  const reader=document.querySelector('.story');
  const chapterNodes=[...reader.querySelectorAll('.chapter')];
  const chapById=new Map(chapterNodes.map(ch=>[ch.id,ch]));
  const sideLinks=[...document.querySelectorAll('.reading-nav a')];
  const picker=document.querySelector('#reading-picker');
  const voice=reader.querySelector('#case-voice');
  const status=reader.querySelector('.status');
  const clips=[...reader.querySelectorAll('video')];
  let activeChapter=chapterNodes[0];
  let voiceButton=null;

  function stopVoice() {
    voice.pause();
    if (voiceButton) {
      voiceButton.setAttribute('aria-pressed','false');
      voiceButton.textContent='도입 듣기';
      voiceButton=null;
    }
  }

  function stopClips() {
    for (const clip of clips) clip.pause();
    reader.querySelectorAll('[data-motion-key]').forEach(key=>key.dispatchEvent(new Event('science-motion-pause')));
  }

  function open(id, move) {
    const chapter=chapById.get(id)||chapterNodes[0];
    const switched=chapter!==activeChapter;
    if (switched) {
      stopVoice();
      stopClips();
    }
    activeChapter=chapter;
    for (const item of chapterNodes) item.hidden=item!==chapter;
    for (const link of sideLinks) {
      if (link.hash.slice(1)===chapter.id) link.setAttribute('aria-current','step');
      else link.removeAttribute('aria-current');
    }
    picker.value=chapter.id;
    if (move) {
      reader.scrollIntoView({block:'start'});
      chapter.querySelector('h2').focus({preventScroll:true});
    }
  }

  function navigate(id) {
    if (location.hash.slice(1)!==id) history.pushState(null,'',`#${id}`);
    open(id,true);
  }

  picker.addEventListener('change',()=>navigate(picker.value));
  for (const link of document.querySelectorAll('[data-case-nav]')) {
    link.addEventListener('click',event=>{
      if (event.metaKey||event.ctrlKey||event.altKey||event.shiftKey) return;
      event.preventDefault();
      navigate(link.hash.slice(1));
    });
  }
  window.addEventListener('hashchange',()=>open(location.hash.slice(1),true));

  reader.addEventListener('click',event=>{
    const button=event.target.closest('[data-case-voice]');
    if (!button) return;
    if (button===voiceButton && !voice.paused) {
      stopVoice();
      return;
    }
    stopVoice();
    stopClips();
    status.textContent='';
    voice.src=button.dataset.caseVoice;
    voiceButton=button;
    button.setAttribute('aria-pressed','true');
    button.textContent='음성 정지';
    voice.play().catch(error=>{
      if (voiceButton!==button||error.name==='AbortError') return;
      stopVoice();
      status.textContent='도입 음성을 불러오지 못했어요.';
    });
  });
  voice.addEventListener('ended',stopVoice);
  for (const clip of clips) {
    clip.addEventListener('play',()=>{
      stopVoice();
      for (const other of clips) if (other!==clip) other.pause();
      reader.querySelectorAll('[data-motion-key]').forEach(key=>key.dispatchEvent(new Event('science-motion-pause')));
    });
  }
  reader.addEventListener('science-motion-start',()=>{
    stopVoice();
    for (const clip of clips) clip.pause();
  },true);
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) {stopVoice();stopClips();}
  });
  const keyHost=reader.querySelector('[data-key-host]');
  if (keyHost) {
    keyHost.innerHTML=renderMotionKey('./media/art/',casebookSpecimens);
    mountMotionKey(keyHost);
  }
  createScienceKeywords(reader,casebookTerms);
  open(location.hash.slice(1),false);
})();

