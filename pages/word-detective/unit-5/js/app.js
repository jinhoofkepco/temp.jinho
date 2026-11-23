/* Word Detective · 데모 진행
 * 사건 한 건: 의뢰 → 조사(단서 열기) → 지목(단어 카드) → 해결
 * 오답: 고른 단어의 뜻 장면을 보여 주고 그 카드를 내려놓는다. 남은 카드가 하나면 힌트로 빛난다.
 */
(function () {
  'use strict';
  var C = window.WD_CONTENT;
  var B = window.WDBridge;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ASSET = 'assets/';
  var session = { id: null, cases: [], skipped: [], results: [], startedAt: 0, configSource: '' };
  var idx = -1, cur = null, cs = null;
  var lastLine = [], lastOpts = null, bs = null;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), panel = $('panel'), caption = $('caption'), progress = $('progress');

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // CSS 변수 안의 url()은 CSS 파일 기준으로 풀리므로 페이지 기준 절대 주소로 바꿔 넣는다
  function absUrl(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- 소리 ---------------- */
  var SFX = (function () {
    var ctx = null;
    function tone(freq, start, dur, type, gain) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(gain || 0.18, ctx.currentTime + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.05);
    }
    return {
      unlock: function () {
        try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
      },
      tap: function () { if (ctx) tone(660, 0, 0.08, 'triangle', 0.12); },
      clue: function () { if (ctx) { tone(523, 0, 0.12, 'triangle'); tone(784, 0.08, 0.16, 'triangle'); } },
      soft: function () { if (ctx) { tone(330, 0, 0.18, 'sine', 0.14); tone(262, 0.14, 0.24, 'sine', 0.12); } },
      stamp: function () { if (ctx) { tone(110, 0, 0.16, 'square', 0.2); tone(80, 0.02, 0.2, 'sine', 0.25); } },
      solved: function () { if (ctx) [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.22, 'triangle', 0.14); }); }
    };
  })();

  var Voice = (function () {
    var a = new Audio();
    a.preload = 'auto';
    var token = 0, enVoice = null;
    var hasTTS = 'speechSynthesis' in window;
    var PITCH = { otto: 1.15, word: 1, dot: 1.45, nana: 1.0, bo: 0.7, mimi: 1.55, ginger: 0.85 };

    function pick() {
      if (!hasTTS) return;
      var vs = speechSynthesis.getVoices();
      enVoice = vs.filter(function (v) { return /en[-_]US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny|Ava/i.test(v.name); })[0] ||
        vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    }
    if (hasTTS) { pick(); speechSynthesis.onvoiceschanged = pick; }

    function playFile(id) {
      if (C.missingAudio[id]) return Promise.resolve(false);
      return new Promise(function (res) {
        var fin = function (ok) { a.onended = a.onerror = null; res(ok); };
        a.onended = function () { fin(true); };
        a.onerror = function () { fin(false); };
        a.src = ASSET + 'audio/' + id + '.mp3';
        var p = a.play();
        if (p && p.catch) p.catch(function () { fin(false); });
      });
    }
    function speak(meta) {
      return new Promise(function (res) {
        var done = false, fin = function () { if (!done) { done = true; res(); } };
        if (!hasTTS) return setTimeout(fin, 500 + meta.text.length * 55);
        var u = new SpeechSynthesisUtterance(meta.text);
        u.lang = 'en-US';
        if (enVoice) u.voice = enVoice;
        u.rate = meta.speaker === 'word' ? 0.75 : 0.92;
        u.pitch = PITCH[meta.speaker] || 1;
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
        setTimeout(fin, 1800 + meta.text.length * 110);
      });
    }
    function play(ids, opts) {
      var my = ++token;
      opts = opts || {};
      ids = [].concat(ids || []);
      var gap = opts.gap || 250;
      var chain = Promise.resolve(true);
      ids.forEach(function (id, n) {
        chain = chain.then(function (alive) {
          if (!alive || my !== token) return false;
          var meta = C.audio[id];
          if (!meta) return true;
          if (opts.sentence) showSentence(ids, n); else showCaption(meta);
          return playFile(id).then(function (ok) {
            if (my !== token) return false;
            return ok ? true : speak(meta).then(function () { return my === token; });
          }).then(function (alive2) {
            return alive2 && n < ids.length - 1 ? wait(gap).then(function () { return my === token; }) : alive2;
          });
        });
      });
      return chain;
    }
    function stop() {
      token++;
      try { a.pause(); } catch (e) {}
      if (hasTTS) speechSynthesis.cancel();
    }
    function unlock() {
      if (hasTTS) { try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
    }
    return { play: play, stop: stop, unlock: unlock };
  })();

  function say(ids) { lastLine = [].concat(ids); lastOpts = null; return Voice.play(ids); }
  // 한 문장을 조각으로 읽기: 조각 사이 0.3초, 자막은 문장 전체에 지금 조각과 열쇠 단어 강조
  function sayS(ids) { lastLine = [].concat(ids); lastOpts = { gap: 300, sentence: true }; return Voice.play(ids, lastOpts); }

  function showSentence(ids, now) {
    var sp = C.audio[ids[0]].speaker;
    caption.innerHTML = '<b>' + esc(cap(sp)) + '</b> ' + ids.map(function (id, k) {
      var m = C.audio[id]; if (!m) return '';
      var cls = (m.speaker === 'word' ? 'key' : '') + (k === now ? ' now' : '');
      return '<span class="seg ' + cls + '">' + capText(m) + '</span>';
    }).join(' ');
  }

  // 빈칸 줄: 음성은 text(… 에서 쉼), 자막은 caption(____ 를 빈칸 상자로)
  function capText(meta) {
    return esc(meta.caption || meta.text).replace(/_{3,}/g, '<span class="gap">&nbsp;</span>');
  }
  function showCaption(meta) {
    caption.innerHTML = '<b>' + esc(cap(meta.speaker === 'word' ? 'word' : meta.speaker)) + '</b> ' + capText(meta);
  }
  // 고른 단어를 빈칸 자막에 넣어 보여 준다
  function showFilled(id, w, final) {
    var m = C.audio[id];
    if (!m || !m.caption) return;
    caption.innerHTML = '<b>Otto</b> ' + esc(m.caption).replace(/_{3,}/, '<span class="gap filled' + (final ? ' final' : '') + '">' + esc(w) + '</span>');
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------- 무대 ---------------- */
  function imgNode(id, cls) {
    var wrap = h('div', 'frame' + (cls ? ' ' + cls : ''));
    var im = new Image();
    im.alt = C.images[id] || id;
    im.draggable = false;
    im.onerror = function () { wrap.replaceChildren(placeholder(id)); };
    if (C.missingImages[id]) {
      wrap.appendChild(placeholder(id));
      return wrap;
    }
    im.src = ASSET + 'img/' + id + '.jpg';
    wrap.appendChild(im);
    return wrap;
  }
  function placeholder(id) {
    var d = h('div', 'ph');
    d.innerHTML = '<span class="ph-tag">그림 준비 중</span><span class="ph-id">' + esc(id) + '</span><span class="ph-desc">' + esc(C.images[id] || '') + '</span>';
    return d;
  }
  function swap(node) {
    var old = stage.querySelectorAll('.frame');
    stage.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('in'); });
    old.forEach(function (o) {
      o.classList.remove('in');
      var v = o.querySelector('video'); if (v) v.pause();
      setTimeout(function () { o.remove(); }, 400);
    });
  }
  function showImg(id) { swap(imgNode(id)); return Promise.resolve(); }
  function showVideo(vid, poster) {
    return new Promise(function (res) {
      var done = false, fin = function () { if (!done) { done = true; res(); } };
      if (reduceMotion) { swap(imgNode(poster)); return fin(); }
      var wrap = h('div', 'frame');
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.preload = 'auto';
      v.poster = ASSET + 'img/' + poster + '.jpg';
      v.onended = fin;
      v.onerror = function () { wrap.replaceWith(imgNode(poster, 'in kenburns')); setTimeout(fin, 2600); };
      v.src = ASSET + 'motion/' + vid + '.mp4';
      v.addEventListener('click', function () { v.currentTime = 0; v.play().catch(function () {}); });
      wrap.appendChild(v);
      wrap.appendChild(h('span', 'replay-badge', '↻'));
      swap(wrap);
      var p = v.play();
      if (p && p.catch) p.catch(function () { setTimeout(fin, 300); });
      setTimeout(fin, 20000);
    });
  }
  function showSpec(spec) { return spec.video ? showVideo(spec.video, spec.poster) : showImg(spec.img); }

  function stampOverlay(text) {
    var s = h('div', 'stamp-overlay', '<span>' + esc(text) + '</span>');
    stage.appendChild(s);
    setTimeout(function () { s.classList.add('out'); }, 1800);
    setTimeout(function () { s.remove(); }, 2300);
  }

  /* ---------------- 진행 표시 ---------------- */
  function renderProgress() {
    progress.innerHTML = '';
    session.cases.forEach(function (c, i) {
      var d = h('span', 'pcase' + (i < idx ? ' done' : i === idx ? ' now' : ''));
      d.title = c.title;
      if (i < idx || (i === idx && cs && cs.solved)) d.classList.add('done');
      progress.appendChild(d);
    });
  }

  /* ---------------- 화면 단계 ---------------- */
  function boot(cfg, source) {
    session.configSource = source;
    session.id = cfg.sessionId || ('local-' + Date.now());
    if (cfg.assetBase) ASSET = cfg.assetBase.replace(/\/?$/, '/');
    var list = Array.isArray(cfg.cases) && cfg.cases.length ? cfg.cases : null;
    if (list) {
      list.forEach(function (item) {
        var sid = typeof item === 'string' ? item : item && item.senseId;
        var mode = typeof item === 'object' && item ? item.mode : 'new';
        if (mode === 'quiz') {               // 여러 단원 복습: 단어 찾기 문항
          var q = quizItem(sid);
          if (q) session.cases.push(q); else session.skipped.push(item);
          return;
        }
        var review = mode === 'review';
        var found = C.cases.filter(function (c) { return c.senseId === sid && !!c.review === review; })[0];
        if (found) session.cases.push(found); else session.skipped.push(item);
      });
    }
    if (!session.cases.length) session.cases = C.cases.slice();
    session.isReview = session.cases.some(function (c) { return c.quiz; });
    var newIds = session.cases.filter(function (c) { return !c.review && !c.quiz; }).map(function (c) { return c.senseId; });
    session.briefing = (C.briefing || []).filter(function (b) { return newIds.indexOf(b.senseId) >= 0; });
    session.briefingResults = [];
    renderStart();
  }

  function renderStart() {
    idx = -1; renderProgress();
    showImg(C.intro.img);
    caption.textContent = '';
    panel.className = 'panel start';
    panel.innerHTML = '';
    var kicker = session.isReview ? '복습 ' + session.cases.length + '문제' : '오늘의 사건 ' + session.cases.length + '건';
    var title = h('div', 'title-card', '<span class="kicker">' + kicker + '</span><span class="big">Word<br>Detective</span>');
    var btn = h('button', 'btn primary huge', '▶ 시작');
    btn.onclick = function () {
      SFX.unlock(); Voice.unlock(); SFX.tap();
      session.startedAt = Date.now();
      btn.disabled = true;
      say(session.isReview && C.quizIntro ? C.quizIntro : C.intro.audio).then(function () { if (!session.exited) startBriefing(0); });
    };
    panel.append(title, btn);
  }


  /* ---------------- 단어 브리핑 ---------------- */
  function wordFrame(word) {
    var f = h('div', 'frame word-frame', '<span class="wf-kicker">Key word</span><span class="wf-word">' + esc(word) + '</span>');
    return f;
  }
  function startBriefing(bi) {
    var b = session.briefing[bi];
    if (!b) return startCase(0);
    bs = { b: b, bi: bi, t0: Date.now(), wrong: 0, step: 0 };
    panel.className = 'panel briefing';
    panel.innerHTML = '';
    var head = h('div', 'brief-head', '<span class="kicker">오늘의 단어 ' + (bi + 1) + '/' + session.briefing.length + '</span><span class="bw">' + esc(b.word) + '</span>');
    var ear = h('button', 'btn icon', '🔊');
    ear.setAttribute('aria-label', '단어 듣기');
    ear.onclick = function () { SFX.tap(); say(['w_' + b.word]); };
    head.appendChild(ear);
    var steps = h('div', 'brief-steps');
    var kinds = b.shots.map(function () { return 'ex'; });
    if (b.summary) kinds.push('sum');
    (b.contrasts || []).forEach(function () { kinds.push('no'); });
    if (b.check) kinds.push('q');
    kinds.forEach(function (kind) { steps.appendChild(h('i', 'st ' + kind)); });
    var actions = h('div', 'brief-actions');
    panel.append(head, steps, actions);
    swap(wordFrame(b.word));
    say(bi > 0 && b.next ? b.next : b.open).then(function () { if (!session.exited) runMontage(); });
  }
  function markStep(k) {
    panel.querySelectorAll('.brief-steps .st').forEach(function (e, i) {
      e.classList.toggle('done', i < k); e.classList.toggle('now', i === k);
    });
  }
  function runMontage() {
    var b = bs.b, k = 0;
    var chain = Promise.resolve();
    b.shots.forEach(function (shot) {
      chain = chain.then(function () {
        if (session.exited) return;
        markStep(k++);
        if (shot.video) return Promise.all([showVideo(shot.video, shot.poster), sayS(shot.say)]);
        swap(imgNode(shot.img, 'pushin'));
        return Promise.all([wait(2200), sayS(shot.say)]);
      });
    });
    if (b.summary) chain = chain.then(function () {
      if (session.exited) return;
      markStep(k++);
      var grid = h('div', 'frame sum-grid n' + b.shots.length);
      b.shots.forEach(function (shot, i) {
        var cell = h('div', 'cell');
        cell.style.animationDelay = (i * 0.08) + 's';
        cell.innerHTML = '<img src="' + ASSET + 'img/' + (shot.poster || shot.img) + '.jpg" alt="">' + (shot.video ? '<span class="arrow">➜</span>' : '');
        grid.appendChild(cell);
      });
      swap(grid);
      return sayS(b.summary);
    });
    (b.contrasts || []).forEach(function (c) {
      chain = chain.then(function () {
        if (session.exited) return;
        markStep(k++);
        swap(imgNode(c.img, 'pushin'));
        return Promise.all([wait(2000), sayS(c.say)]);
      });
    });
    chain.then(function () { if (!session.exited) (b.check ? briefCheck(k) : briefNext(null)); });
  }
  // 브리핑 하나가 끝났을 때: 결과 기록, 다음 단어 또는 사건 시작 버튼
  function briefNext(firstTry) {
    var b = bs.b;
    session.briefingResults.push({ senseId: b.senseId, word: b.word, checkFirstTry: firstTry, durationMs: Date.now() - bs.t0 });
    markStep(panel.querySelectorAll('.brief-steps .st').length);
    var acts = panel.querySelector('.brief-actions');
    acts.innerHTML = '';
    var last = bs.bi === session.briefing.length - 1;
    var mid = last && midItems().length;
    var go = h('button', 'btn primary next', mid ? '중간 점검 ▶' : last ? '사건 시작 ▶' : '다음 단어 ▶');
    go.onclick = function () { SFX.tap(); Voice.stop(); mid ? startMid() : last ? startCase(0) : startBriefing(bs.bi + 1); };
    acts.appendChild(go);
    if (mid) say(C.midIntro);
    else if (last) say(session.briefing.length > 1 && C.briefingDoneAll ? C.briefingDoneAll : b.done);
  }

  /* ---------------- 중간 점검: 그날 단어를 다 배운 뒤, 단어를 가리고 섞어서 ---------------- */
  // 문항마다: 처음 보는 그림(또는 확인 정답 그림) + 단어를 뺀 문장 → 단어 카드 3장(그날 다른 단어 우선)
  function midItems() {
    if (session.midItems) return session.midItems;
    var M = C.midcheck || {}, list = [];
    session.briefing.forEach(function (b) { if (M[b.senseId]) list.push({ senseId: b.senseId, m: M[b.senseId] }); });
    // 배운 순서와 다르게: 홀수 자리 먼저, 그다음 짝수 자리 (마지막에 배운 단어가 첫 문제가 되지 않게)
    var odd = list.filter(function (_, i) { return i % 2 === 1; }), even = list.filter(function (_, i) { return i % 2 === 0; });
    list = odd.concat(even);
    if (list.length > 1 && list[0].m.word === session.briefing[session.briefing.length - 1].word) list.push(list.shift());
    var today = []; list.forEach(function (x) { if (today.indexOf(x.m.word) < 0) today.push(x.m.word); });
    list.forEach(function (x, i) {
      var w = x.m.word, others = today.filter(function (o) { return o !== w; });
      others = others.slice(i % Math.max(1, others.length)).concat(others.slice(0, i % Math.max(1, others.length)));
      var ds = others.slice(0, 2);
      if (ds.length < 2) {                     // 그날 단어가 적으면 그 뜻 사건의 오답 단어로 채운다
        var k = C.cases.filter(function (c) { return c.senseId === x.senseId && !c.review; })[0];
        (k ? k.choices : []).forEach(function (c) { if (ds.length < 2 && c !== w && ds.indexOf(c) < 0 && C.library[c]) ds.push(c); });
      }
      var ch = ds.slice(); ch.splice((i + 1) % (ds.length + 1), 0, w);
      x.choices = ch;
    });
    session.midItems = list;
    return list;
  }
  function startMid() { session.midResults = []; midAsk(0); }
  function midAsk(i) {
    var list = midItems(), x = list[i];
    if (!x) return midDone();
    var m = x.m, wrong = [], picked = null, solved = false;
    panel.className = 'panel investigate quiz';
    panel.innerHTML = '';
    var head = h('div', 'case-head');
    head.innerHTML = '<span class="case-no">중간 점검 ' + (i + 1) + '/' + list.length + '</span><span class="case-title">Which word is it?</span>';
    var ear = h('button', 'btn icon', '🔊');
    ear.setAttribute('aria-label', '질문 다시 듣기');
    ear.onclick = function () { SFX.tap(); ask(); };
    head.appendChild(ear);
    var box = h('div', 'cards show');
    panel.append(head, box);
    swap(imgNode(m.img));
    function blankCap() { var a = C.audio[m.ask[0]]; if (a && a.caption && !solved && !picked) caption.innerHTML = '<b>Otto</b> ' + capText(a); }
    function ask() { return say(m.ask).then(blankCap); }
    var go = h('button', 'btn stamp-btn', '<span class="seal">✓</span> 이 단어야!');
    go.disabled = true;
    x.choices.forEach(function (w) {
      var c = h('button', 'card', '<span class="word">' + esc(w) + '</span><span class="ear">🔊</span>');
      c.dataset.w = w;
      c.onclick = function () {
        if (solved) return;
        SFX.tap();
        if (wrong.indexOf(w) >= 0) { var lb = C.library[w]; if (lb) say([lb.audio]); return; }
        picked = w;
        box.querySelectorAll('.card').forEach(function (e) { e.classList.toggle('selected', e.dataset.w === w); });
        go.disabled = false;
        say(['w_' + w]).then(function () { if (!solved && picked === w) showFilled(m.ask[0], w); });
      };
      box.appendChild(c);
    });
    go.onclick = function () {
      if (!picked || solved) return;
      Voice.stop();
      var w = picked, c = box.querySelector('.card[data-w="' + w + '"]');
      picked = null; go.disabled = true; c.classList.remove('selected');
      if (w === m.word) {
        solved = true; SFX.stamp(); c.classList.add('stamped');
        box.querySelectorAll('.card').forEach(function (e) { e.disabled = true; });
        go.remove();
        showFilled(m.ask[0], w, true);
        session.midResults.push({ senseId: x.senseId, word: m.word, firstTry: wrong.length === 0, wrongPicks: wrong.slice() });
        var r = (session.briefingResults || []).filter(function (b) { return b.senseId === x.senseId; })[0];
        if (r) { r.midCheckFirstTry = wrong.length === 0; r.midCheckWrongPicks = wrong.slice(); }
        (m.sentence ? sayS(m.answer) : say(m.answer)).then(function () {
          if (session.exited) return;
          return echoWord(m.word);
        }).then(function () {
          if (session.exited) return;
          SFX.solved();
          var last = i === list.length - 1;
          var nx = h('button', 'btn primary next', last ? '사건 시작 ▶' : '다음 문제 ▶');
          nx.onclick = function () { SFX.tap(); Voice.stop(); last ? startCase(0) : midAsk(i + 1); };
          panel.appendChild(nx);
          say(last ? (C.briefingDoneAll || ['b_ready_all']) : ['otto_quiz_next']);
        });
        return;
      }
      wrong.push(w); SFX.soft(); c.classList.add('down');
      var lb = C.library[w], lines = lb ? [lb.audio] : [];
      var left = x.choices.filter(function (o) { return wrong.indexOf(o) < 0; });
      if (left.length === 1) {
        box.querySelector('.card[data-w="' + m.word + '"]').classList.add('glow');
        lines = lines.concat(['otto_hint', 'w_' + m.word]);
      } else {
        lines = lines.concat(['b_again'], m.ask);
      }
      say(lines).then(blankCap);
    };
    box.appendChild(go);
    ask();
  }
  function midDone() { startCase(0); }
  function briefCheck(k) {
    var b = bs.b, q = b.check;
    markStep(k);
    var f = h('div', 'frame choose');
    q.choices.forEach(function (ch, i) {
      var btn = h('button', 'pick');
      btn.innerHTML = '<img src="' + ASSET + 'img/' + ch.img + '.jpg" alt="' + esc(C.images[ch.img] || '') + '"><span class="num">' + (i + 1) + '</span>';
      btn.onclick = function () { pick(btn, ch); };
      f.appendChild(btn);
    });
    swap(f);
    var acts = panel.querySelector('.brief-actions');
    acts.innerHTML = '';
    var again = h('button', 'btn', '🎬 다시 보기');
    again.onclick = function () { SFX.tap(); Voice.stop(); acts.innerHTML = ''; runMontage(); };
    acts.appendChild(again);
    sayS(q.ask);
    var locked = false;
    function pick(btn, ch) {
      if (locked) return;
      Voice.stop();
      if (ch.correct) {
        locked = true;
        SFX.stamp(); btn.classList.add('right');
        f.querySelectorAll('.pick').forEach(function (x) { if (x !== btn) x.classList.add('fade'); });
        markStep(k + 1);
        sayS(q.yes).then(function () {
          if (session.exited) return;
          SFX.solved();
          briefNext(bs.wrong === 0);
        });
      } else {
        bs.wrong++;
        SFX.soft(); btn.classList.add('wrong');
        setTimeout(function () { btn.classList.remove('wrong'); }, 700);
        sayS(q.no);
      }
    }
  }
  function startCase(i) {
    idx = i; cur = session.cases[i];
    cs = { t0: Date.now(), opened: {}, wrong: [], hint: false, selected: null, solved: false, cards: false };
    if (cur.quiz) return startQuiz();
    renderProgress();
    panel.className = 'panel listening';
    panel.innerHTML = '';
    panel.append(caseHead(), h('div', 'listening-dots', '<i></i><i></i><i></i>'));
    showImg(cur.scene.img);
    say(cur.scene.audio).then(function () { if (!session.exited) renderInvestigate(true); });
  }

  function caseHead() {
    var head = h('div', 'case-head');
    head.innerHTML = '<span class="case-no">사건 ' + (idx + 1) + '/' + session.cases.length + (cur.review ? ' · 다시 만난 단어' : '') + '</span>' +
      '<span class="case-title">' + esc(cur.title) + '</span>';
    var q = h('button', 'btn icon', '🔊');
    q.setAttribute('aria-label', '질문 다시 듣기');
    // 카드가 나온 뒤에는 빈칸 질문을 다시 들려준다
    q.onclick = function () { SFX.tap(); say(cs && cs.cards && cur.blank ? cur.blank : [cur.question]); };
    head.appendChild(q);
    return head;
  }

  function renderInvestigate(first) {
    if (cs.panelBuilt) return;
    cs.panelBuilt = true;
    panel.className = 'panel investigate';
    panel.innerHTML = '';
    panel.appendChild(caseHead());

    var clues = h('div', 'clues');
    var sceneTile = h('button', 'tile scene', '<span class="tile-ico">🏠</span><span class="tile-lbl">현장</span>');
    sceneTile.onclick = function () { SFX.tap(); Voice.stop(); markTile(null); showImg(cur.scene.img); };
    clues.appendChild(sceneTile);
    cur.clues.forEach(function (clue, k) {
      var t = h('button', 'tile clue', '<span class="tile-ico">🔍</span><span class="tile-lbl">단서 ' + (k + 1) + '</span>');
      t.dataset.k = k;
      t.onclick = function () { openClue(k); };
      clues.appendChild(t);
    });
    panel.appendChild(clues);
    panel.appendChild(h('div', 'cards'));
    if (first) say(['otto_investigate']);
  }

  function markTile(k) {
    panel.querySelectorAll('.tile').forEach(function (t) {
      t.classList.toggle('active', t.dataset.k != null && +t.dataset.k === k);
    });
  }

  function openClue(k) {
    var clue = cur.clues[k];
    Voice.stop(); SFX.clue();
    cs.opened[k] = true;
    var tile = panel.querySelector('.tile[data-k="' + k + '"]');
    if (tile && !tile.classList.contains('opened')) {
      tile.classList.add('opened');
      var thumb = clue.img || clue.poster;
      tile.style.setProperty('--thumb', 'url("' + absUrl(ASSET + 'img/' + thumb + '.jpg') + '")');
    }
    panel.querySelectorAll('.tile.pulse').forEach(function (t) { t.classList.remove('pulse'); });
    markTile(k);
    Promise.all([showSpec(clue), say(clue.audio)]).then(function () {
      if (session.exited || !cs) return;
      if (!cs.cards && Object.keys(cs.opened).length === cur.clues.length) showCards();
    });
  }

  function showCards() {
    cs.cards = true;
    var box = panel.querySelector('.cards');
    box.innerHTML = '';
    cur.choices.forEach(function (w) {
      var c = h('button', 'card', '<span class="word">' + esc(w) + '</span><span class="ear">🔊</span>');
      c.dataset.w = w;
      c.onclick = function () { tapCard(w); };
      box.appendChild(c);
    });
    var go = h('button', 'btn stamp-btn', '<span class="seal">✓</span> 이 단어야!');
    go.disabled = true;
    go.onclick = function () { if (cs.selected) judge(cs.selected); };
    box.appendChild(go);
    box.classList.add('show');
    say(cur.blank || ['otto_accuse']).then(keepBlank);
  }
  // 질문이 끝나면 빈칸 문장을 자막에 남겨 둔다(아이가 보면서 고르게)
  function keepBlank() {
    var bl = cur && (cur.blank || cur.ask);
    if (!bl || !cs || cs.solved || cs.selected) return;
    var m = C.audio[bl[0]];
    if (m && m.caption) caption.innerHTML = '<b>Otto</b> ' + capText(m);
  }

  function card(w) { return panel.querySelector('.card[data-w="' + w + '"]'); }

  function tapCard(w) {
    if (cs.solved) return;
    SFX.tap();
    if (cs.wrong.indexOf(w) >= 0) {        // 내려놓은 카드: 뜻 장면 다시 보기
      var lib = C.library[w];
      if (lib) { if (!cur.quiz) showImg(lib.img); say([lib.audio]); }
      return;
    }
    cs.selected = w;
    panel.querySelectorAll('.card').forEach(function (c) { c.classList.toggle('selected', c.dataset.w === w); });
    panel.querySelector('.stamp-btn').disabled = false;
    var bl = cur.blank || (cur.ask && cur.ask);
    say(['w_' + w]).then(function () { if (bl && cs && !cs.solved && cs.selected === w) showFilled(bl[0], w); });
  }

  function judge(w) {
    Voice.stop();
    if (w === cur.word) return cur.quiz ? quizSolve() : solve();
    wrong(w);
  }

  function wrong(w) {
    SFX.soft();
    cs.wrong.push(w);
    cs.selected = null;
    var c = card(w);
    c.classList.remove('selected');
    c.classList.add('down');
    var lib = C.library[w];
    if (lib && !C.missingImages[lib.img]) c.style.setProperty('--thumb', 'url("' + absUrl(ASSET + 'img/' + lib.img + '.jpg') + '")');
    panel.querySelector('.stamp-btn').disabled = true;
    var left = cur.choices.filter(function (x) { return cs.wrong.indexOf(x) < 0; });
    var lines = lib ? [lib.audio] : [];
    if (lib && !cur.quiz) showImg(lib.img);
    if (left.length === 1) {
      cs.hint = true;
      lines = lines.concat(['otto_hint', 'w_' + cur.word]);
      card(cur.word).classList.add('glow');
    } else if (cur.quiz) {
      lines = lines.concat(['b_again'], cur.ask);    // 단어 찾기: 고른 단어 뜻 → 다시 질문
    } else {
      lines.push('otto_retry');
      if (cur.blank) lines.push(cur.blank[0]);  // 빈칸 질문을 한 번 더
      panel.querySelectorAll('.tile.clue').forEach(function (t) { t.classList.add('pulse'); });
    }
    say(lines).then(keepBlank);
  }

  function solve() {
    cs.solved = true;
    SFX.stamp();
    var c = card(cur.word);
    c.classList.remove('glow');
    c.classList.add('stamped');
    panel.querySelectorAll('.card').forEach(function (x) { x.disabled = true; });
    panel.querySelector('.stamp-btn').remove();
    markTile(null);
    var result = {
      senseId: cur.senseId,
      word: cur.word,
      mode: cur.review ? 'review' : 'new',
      solved: true,
      firstTry: cs.wrong.length === 0,
      wrongPicks: cs.wrong.slice(),
      hintUsed: cs.hint,
      cluesOpened: Object.keys(cs.opened).length,
      cluesTotal: cur.clues.length,
      durationMs: Date.now() - cs.t0
    };
    session.results.push(result);
    B.caseResult(result);
    renderProgress();
    Promise.all([showSpec(cur.solution), say(cur.solution.audio)]).then(function () {
      if (session.exited) return;
      return echoWord(cur.word);               // 단어를 한 번 더 귀와 입으로
    }).then(function () {
      SFX.solved();
      stampOverlay('SOLVED');
      return say(['otto_solved_' + (1 + (idx % 3))]);
    }).then(function () {
      if (session.exited) return;
      var last = idx === session.cases.length - 1;
      var next = h('button', 'btn primary next', last ? '사건 종결 ▶' : '다음 사건 ▶');
      next.onclick = function () { SFX.tap(); Voice.stop(); last ? finish() : startCase(idx + 1); };
      panel.appendChild(next);
      if (!last) say(['otto_next']);
    });
  }

  // 해결 뒤 되풀이: "Say it with me!" → 단어 → (아이가 따라 말할 틈) → 단어
  function echoWord(w) {
    if (!C.audio.otto_sayit) return Promise.resolve();
    var big = h('div', 'echo-word', esc(w));
    stage.appendChild(big);
    return Voice.play(['otto_sayit', 'w_' + w, 'w_' + w], { gap: 1300 }).then(function () { big.remove(); });
  }

  /* ---------------- 여러 단원 복습: 단어 찾기 ---------------- */
  function quizItem(sid) {
    var Q = C.quiz || {};
    for (var w in Q) if (Q[w].senseId === sid) {
      var q = Q[w];
      return { quiz: true, senseId: sid, word: w, title: 'Find the word', img: q.img, ask: q.ask, answer: q.answer, choices: q.choices };
    }
    return null;
  }
  function startQuiz() {
    renderProgress();
    panel.className = 'panel investigate quiz';
    panel.innerHTML = '';
    var head = h('div', 'case-head');
    head.innerHTML = '<span class="case-no">복습 ' + (idx + 1) + '/' + session.cases.length + ' · 단어 찾기</span><span class="case-title">Which word is it?</span>';
    var ear = h('button', 'btn icon', '🔊');
    ear.setAttribute('aria-label', '질문 다시 듣기');
    ear.onclick = function () { SFX.tap(); say(cur.ask); };
    head.appendChild(ear);
    panel.append(head, h('div', 'cards'));
    showImg(cur.img);
    cs.cards = true;
    var box = panel.querySelector('.cards');
    cur.choices.forEach(function (w) {
      var c = h('button', 'card', '<span class="word">' + esc(w) + '</span><span class="ear">🔊</span>');
      c.dataset.w = w;
      c.onclick = function () { tapCard(w); };
      box.appendChild(c);
    });
    var go = h('button', 'btn stamp-btn', '<span class="seal">✓</span> 이 단어야!');
    go.disabled = true;
    go.onclick = function () { if (cs.selected) judge(cs.selected); };
    box.appendChild(go);
    box.classList.add('show');
    say(cur.ask).then(keepBlank);
  }
  function quizSolve() {
    cs.solved = true;
    SFX.stamp();
    var c = card(cur.word);
    c.classList.remove('glow'); c.classList.add('stamped');
    panel.querySelectorAll('.card').forEach(function (x) { x.disabled = true; });
    panel.querySelector('.stamp-btn').remove();
    showFilled(cur.ask[0], cur.word, true);
    var result = { senseId: cur.senseId, word: cur.word, mode: 'quiz', solved: true, firstTry: cs.wrong.length === 0,
      wrongPicks: cs.wrong.slice(), hintUsed: cs.hint, cluesOpened: 0, cluesTotal: 0, durationMs: Date.now() - cs.t0 };
    session.results.push(result);
    B.caseResult(result);
    renderProgress();
    say(cur.answer).then(function () {
      if (session.exited) return;
      return echoWord(cur.word);
    }).then(function () {
      if (session.exited) return;
      SFX.solved();
      var last = idx === session.cases.length - 1;
      var next = h('button', 'btn primary next', last ? '복습 끝 ▶' : '다음 문제 ▶');
      next.onclick = function () { SFX.tap(); Voice.stop(); last ? finish() : startCase(idx + 1); };
      panel.appendChild(next);
      if (!last) say(['otto_quiz_next']);
    });
  }

  function finish() {
    idx = session.cases.length; cs = null;
    renderProgress();
    showImg(C.outro.img);
    panel.className = 'panel finish';
    panel.innerHTML = '';
    var firstTry = session.results.filter(function (r) { return r.firstTry; }).length;
    if (session.isReview) {
      panel.appendChild(h('div', 'title-card', '<span class="kicker">복습 ' + session.results.length + '문제</span><span class="big">Review<br>Done!</span><span class="sub">한 번에 맞힌 문제 ' + firstTry + '개</span>'));
    } else {
      panel.appendChild(h('div', 'title-card', '<span class="kicker">사건 ' + session.results.length + '건 해결</span><span class="big">Case<br>Closed!</span><span class="sub">한 번에 맞힌 사건 ' + firstTry + '건</span>'));
    }
    var done = h('button', 'btn primary huge', '끝내기');
    done.onclick = function () { SFX.tap(); doExit('completed'); };
    panel.appendChild(done);
    say(session.isReview && C.quizOutro ? C.quizOutro : C.outro.audio);
  }

  /* ---------------- 나가기 ---------------- */
  function doExit(reason) {
    if (session.exited) return;
    session.exited = true;
    Voice.stop();
    var unfinished = session.cases.slice(Math.max(0, session.results.length)).map(function (c) {
      return { senseId: c.senseId, mode: c.quiz ? 'quiz' : c.review ? 'review' : 'new' };
    });
    B.exit({
      sessionId: session.id,
      reason: reason,
      results: session.results,
      unfinished: unfinished,
      skipped: session.skipped,
      briefing: session.briefingResults || [],
      durationMs: session.startedAt ? Date.now() - session.startedAt : 0
    });
    $('confirm').hidden = true;
    panel.className = 'panel bye';
    panel.innerHTML = '';
    panel.appendChild(h('div', 'title-card', '<span class="big">See you<br>tomorrow!</span>'));
    if (B.channel() === 'standalone') {
      var again = h('button', 'btn', '처음부터 다시');
      again.onclick = function () { location.reload(); };
      panel.appendChild(again);
    }
    $('exitBtn').hidden = true;
  }

  $('exitBtn').onclick = function () { SFX.tap(); $('confirm').hidden = false; };
  $('stay').onclick = function () { SFX.tap(); $('confirm').hidden = true; };
  $('leave').onclick = function () { doExit('user_exit'); };
  $('replayBtn').onclick = function () { SFX.tap(); if (lastLine.length) { var o = lastOpts; Voice.play(lastLine, o); } };
  B.onRequestExit(function () { doExit('host_request'); });

  var avail = C.cases.map(function (c) { return { senseId: c.senseId, mode: c.review ? 'review' : 'new' }; });
  Object.keys(C.quiz || {}).forEach(function (w) { avail.push({ senseId: C.quiz[w].senseId, mode: 'quiz' }); });
  B.onInit(boot, avail, C.version);
})();
