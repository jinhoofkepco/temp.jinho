"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const noteKey = "masternote-pair-review.v1.notes",
  draftKey = "masternote-pair-review.v1.drafts";
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
let notes = load(noteKey, []),
  drafts = load(draftKey, {});
if (!Array.isArray(notes)) notes = [];
if (!drafts || typeof drafts !== "object") drafts = {};
let current,
  step = 0,
  scope = "공통",
  modal = "",
  zoomRole = "",
  activeTrigger = null,
  timer,
  editing = null,
  points = {};
const appOrder = new Map(scenes.map((s, i) => [s.id, i + 1])),
  groupsById = new Map(groups.map((g) => [g.id, g]));
function notify(msg) {
  $("liveMsg").textContent = msg;
  $("liveMsg").classList.add("on");
  clearTimeout(timer);
  timer = setTimeout(() => $("liveMsg").classList.remove("on"), 2000);
}
function persist(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
const names = ["중1 상", "중1 하", "수학 연습", "도형 노트"];
function cover(i) {
  return (
    '<div class="bookcover" style="background-image:url(art/cover_' +
    i +
    '.webp)"><strong>' +
    (i < 2 ? "황소 프라임<br>" : "") +
    names[i] +
    "</strong></div>"
  );
}
function shelf(mode) {
  return (
    '<div class="shelfpaper"><div class="shelfgrid">' +
    [0, 1, 2, 3]
      .map(
        (i) =>
          '<div class="bookcard">' +
          cover(i) +
          "<small>" +
          [44, 54, 7, 0][i] +
          " / " +
          [200, 222, 80, 64][i] +
          '쪽</small><div class="bar"><i style="width:' +
          [22, 24, 8, 0][i] +
          '%"></i></div></div>',
      )
      .join("") +
    "</div></div>" +
    (mode === "shelfNew"
      ? '<div class="app-note">새 문제집을 가져왔어요</div>'
      : "")
  );
}
function pages(mode) {
  const variant = mode === "variants" || mode === "ten",
    count = mode === "ten" ? 10 : 5;
  const nums = variant
    ? Array.from({ length: count }, (_, i) => i + 1)
    : [47, 48, 49, 50, 51, 52];
  return (
    '<div class="pagespaper"><div class="pagesplit"><div class="mini-cover">' +
    cover(0) +
    '</div><div class="minipages"><div class="mini-tabs">' +
    (variant
      ? "<span>본문 200쪽</span><b>변형 " + count + "쪽</b>"
      : "<b>본문 200쪽</b><span>변형 5쪽</span>") +
    "</div>" +
    (variant
      ? ""
      : '<div class="gridlabel">최근 필기</div><div class="mini-tabs"><b>48쪽</b><span>36쪽</span></div>') +
    '<div class="gridlabel">' +
    (variant ? "변형문제" : "전체 쪽") +
    '</div><div class="pgrid">' +
    nums
      .map(
        (n) =>
          '<div class="tile ' +
          ((variant ? n === 1 : n === 48) ? "selected" : "") +
          '">' +
          (variant ? "변형 " : "") +
          n +
          "쪽<small>" +
          ((variant ? n === 1 : n === 48) ? "풀이 중" : "미시작") +
          "</small></div>",
      )
      .join("") +
    "</div></div></div></div>"
  );
}
function opt(t, style = "") {
  return '<div class="app-opt ' + style + '">' + t + "</div>";
}
function panel(icon, kicker, title, desc, options = "", big = "") {
  return (
    '<div class="apppanel"><div class="panelcard"><span class="screen-label">' +
    kicker +
    "</span><h3>" +
    title +
    "</h3>" +
    (big ? '<div class="big-number">' + big + "</div>" : "") +
    "<p>" +
    desc +
    "</p>" +
    options +
    "</div></div>"
  );
}
function bar(label, tone = "") {
  return '<div class="app-note ' + tone + '">' + label + "</div>";
}
const panels = {
  import: () =>
    panel(
      "",
      "내 책장",
      "PDF 가져오기",
      "문제집 파일 선택",
      opt("수학 연습.pdf", "on"),
    ),
  answerChoice: () =>
    panel(
      "",
      "답안 연결",
      "답안을 어떻게 가져올까요?",
      "",
      opt("PDF 파일") + opt("화면 캡처", "on"),
    ),
  answerFile: () =>
    panel(
      "",
      "답안 PDF",
      "답안 파일 선택",
      "중1 상 답안.pdf",
      opt("답안 영역 지정", "on"),
    ),
  linked: () =>
    panel(
      "",
      "답안 보기",
      "48쪽 연결 답안",
      "3x + 4 = 19",
      opt("3x = 15　 →　 x = 5", "blue"),
    ),
  loading: () =>
    panel(
      "",
      "실시간 보기",
      "중1 하를 여는 중",
      "48쪽 · 다음 문제와 필기를 불러오는 중입니다.",
      '<div class="imageline"></div>',
    ),
  offline: () =>
    panel(
      "",
      "실시간 보기",
      "학생 기기를 찾을 수 없어요",
      "서아 탭에서 문제집과 연결 상태를 확인해 주세요.",
      opt("확인"),
    ),
  makeMenu: () =>
    panel(
      "",
      "선택한 문제",
      "캡처로 할 일",
      "중1 상 · 본문 48쪽",
      opt("변형퀴즈 5문제 만들기", "on") + opt("문제 만들고 인쇄"),
    ),
  generating: () =>
    panel(
      "",
      "변형퀴즈",
      "5문제 만드는 중",
      "일차방정식 · 계산 조건과 숫자를 검산합니다.",
      '<div class="imageline"></div>',
    ),
  types: () =>
    panel(
      "",
      "풀어본 유형",
      "일차방정식 풀기",
      "5문제 준비 · 중1 상",
      opt("원래 문제집에서 열기", "on"),
    ),
  goal: () =>
    panel(
      "",
      "유형 목표",
      "한 문제 목표 시간",
      "일차방정식 풀기",
      opt("02분　00초") + opt("목표 저장", "on"),
    ),
  goalDone: () =>
    panel(
      "",
      "유형 목표",
      "목표 시간 설정됨",
      "새로 여는 문제부터 적용됩니다.",
      "",
      "2분",
    ),
  more: () =>
    panel(
      "",
      "풀어본 유형",
      "일차방정식 풀기",
      "맞힌 문제 2 / 5",
      opt("다음 5문제 만들기", "on"),
    ),
  print: () =>
    panel(
      "",
      "인쇄 요청",
      "문제 만들고 인쇄",
      "캡처한 문제에서 숫자만 새로 바꿔서 문제를 만들고 바로 인쇄해줘.",
      opt("새로 받아쓰기") + opt("문제 만들고 인쇄", "on"),
    ),
  dictate: () =>
    panel(
      "",
      "인쇄 요청",
      "새로 받아쓰기",
      "“숫자를 바꿔 두 문제 만들어줘.”",
      opt("요청 확인", "on"),
    ),
  printed: () =>
    panel(
      "",
      "Mac 인쇄",
      "인쇄 요청을 보냈어요",
      "Epson L805 · 문제지",
      opt("요청 내용 보기"),
    ),
  key: () =>
    panel(
      "",
      "아빠 · 답 보기",
      "정답과 풀이",
      "2x + 3 = 17",
      opt("2x = 14") + opt("정답　x = 7", "blue"),
    ),
  grading: () =>
    panel(
      "",
      "변형 1쪽",
      "풀이 확인 중",
      "제출한 필기와 풀이 시간을 확인하고 있어요.",
      '<div class="imageline"></div>',
    ),
  correct: () =>
    panel(
      "",
      "변형 1쪽",
      "정답이에요",
      "2x + 3 = 17　·　x = 7",
      opt("집중도 보상　20원", "on"),
    ),
  bonus: () =>
    panel(
      "",
      "변형 1쪽",
      "목표를 달성했어요",
      "1분 34초 / 목표 2분",
      opt("유형 목표 첫 달성", "on"),
      "100원",
    ),
  reward20: () =>
    panel(
      "",
      "AiFather · 지급 내역",
      "변형퀴즈 정답",
      "일차방정식 · 1번",
      opt("집중도 보상"),
      "＋20원",
    ),
  reward100: () =>
    panel(
      "",
      "AiFather · 지급 내역",
      "유형 목표 달성",
      "일차방정식 · 1번",
      opt("첫 목표 달성 보상"),
      "＋100원",
    ),
};
const geoSet = new Set([
  "geo",
  "geoInk",
  "geoTel",
  "pending",
  "local",
  "marked",
  "markDraft",
  "browse",
]);
const quizSet = new Set([
  "quiz",
  "written",
  "timed",
  "boxed",
  "submitted",
  "wrong",
  "wrongDad",
  "retry",
]);
function toolsRow(kid, isQuiz) {
  return (
    '<div class="sim-tools">' +
    (kid
      ? '<span class="tool-on">펜</span><span>자</span><span>컴퍼스</span><span class="right ' +
        (isQuiz ? "tool-submit" : "") +
        '">' +
        (isQuiz ? "제출" : "메모") +
        "</span>"
      : '<span class="tool-on">실시간</span><span>채점</span><span class="right">답</span>') +
    "</div>"
  );
}
function paper(mode, kid) {
  const geo = geoSet.has(mode),
    q = quizSet.has(mode),
    browsing = mode === "browse",
    review = mode === "wrong" || mode === "wrongDad";
  const note = {
    geoTel: ["Telegram 수신", "check"],
    pending: ["마지막 수신 · 동기화 중", "warn"],
    local: ["기기에 저장됨", ""],
    marked: ["첨삭이 도착했어요", "check"],
    markDraft: ["채점할 위치 선택", ""],
    browse: ["학생 화면 다시 따라가기", "check"],
    timed: ["한 문제 목표 2분", ""],
    submitted: ["1회차 제출됨", "check"],
    wrong: ["표시된 줄을 다시 보세요", "warn"],
    wrongDad: ["부호가 바뀐 줄 확인", "warn"],
    retry: ["다시 풀기 · 2회차", ""],
    answerCrop: ["선택 영역을 답안으로 가져오기", ""],
    selection: ["선택 영역 확인", ""],
  };
  const heading = geo
    ? browsing
      ? "삼각형의 성질"
      : "수직이등분선 작도"
    : mode === "answerCrop"
      ? "답안 예시"
      : q
        ? "일차방정식 풀기"
        : "식의 값 구하기";
  const penMode =
    (current.id === "write" && geo) || (current.id === "quiz-write" && q);
  const coord = geo ? "360,150" : "360,140";
  const canvas =
    '<div class="plot-space"><div class="plot-content ' +
    (geo ? "geometry" : "algebra") +
    '"><canvas class="exercise' +
    (penMode && kid ? " writable" : "") +
    '" data-ink="' +
    (penMode ? "yes" : "no") +
    '" data-mode="' +
    mode +
    '" data-size="' +
    coord +
    '" aria-label="' +
    (geo ? "선분 AB와 작도선" : q ? "방정식과 풀이" : "방정식") +
    '"></canvas>' +
    (review ? '<span class="error-ring" aria-hidden="true"></span>' : "") +
    "</div></div>";
  return (
    '<div class="sheetpaper"><div class="folio"><b>' +
    (geo ? "중1 하" : "중1 상") +
    "</b><span>" +
    (q ? "변형 1쪽" : "본문 " + (browsing ? "47" : "48") + "쪽") +
    '</span></div><div class="qnumber">' +
    (geo ? "개념탐구 " + (browsing ? "3" : "4") : q ? "01" : "예제 2") +
    '</div><div class="problem">' +
    heading +
    "</div>" +
    canvas +
    (mode === "selection" || mode === "answerCrop"
      ? '<div class="selection"></div>'
      : "") +
    "</div>" +
    (note[mode] ? bar(...note[mode]) : "") +
    toolsRow(kid, q && !review)
  );
}
function view(mode, role) {
  const kid = role === "kid",
    isShelf = mode.startsWith("shelf"),
    pg = ["pages", "variants", "ten"].includes(mode);
  const link =
    mode === "offline" || mode === "local"
      ? "오프라인"
      : mode === "pending"
        ? "수신 대기"
        : mode === "geoTel"
          ? "Telegram"
          : "Wi-Fi";
  const h = isShelf
    ? "내 책장"
    : pg
      ? "황소 프라임 중1 상"
      : panels[mode]
        ? "마스터노트"
        : geoSet.has(mode)
          ? "황소 프라임 중1 하"
          : "황소 프라임 중1 상";
  const top = isShelf
    ? kid
      ? "학생"
      : "● 실시간"
    : pg
      ? kid
        ? "학생"
        : "선생님"
      : panels[mode]
        ? kid
          ? "학생"
          : "선생님"
        : link;
  return (
    '<div class="device ' +
    (kid ? "tab" : "phone") +
    '"><div class="device-head"><span class="backmark" aria-hidden="true">‹</span><b>' +
    h +
    '</b><span class="device-state ' +
    (link === "오프라인" ? "bad" : "") +
    '">' +
    top +
    '</span></div><div class="device-body">' +
    (isShelf
      ? shelf(mode)
      : pg
        ? pages(mode)
        : panels[mode]
          ? panels[mode]()
          : paper(mode, kid)) +
    '</div><div class="screen-foot"></div></div>'
  );
}
function plot(canvas) {
  const [w, h] = canvas.dataset.size.split(",").map(Number),
    dpr = 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext("2d");
  c.scale(dpr, dpr);
  c.lineJoin = "round";
  c.lineCap = "round";
  const mode = canvas.dataset.mode,
    geo = geoSet.has(mode),
    quiz = quizSet.has(mode);
  function line(x, y, X, Y, color = "#556053", width = 1.7) {
    c.beginPath();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.moveTo(x, y);
    c.lineTo(X, Y);
    c.stroke();
  }
  function curve(coords, color, width = 2) {
    c.beginPath();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.moveTo(coords[0], coords[1]);
    c.bezierCurveTo(...coords.slice(2));
    c.stroke();
  }
  function txt(t, x, y, size, color = "#3d4338", style = "") {
    c.fillStyle = color;
    c.font =
      (style ? style + " " : "") +
      size +
      'px Georgia, "Apple SD Gothic Neo", sans-serif';
    c.fillText(t, x, y);
  }
  if (geo) {
    if (mode === "browse") {
      line(65, 117, 157, 25);
      line(157, 25, 274, 117);
      line(65, 117, 274, 117);
      txt("A", 48, 135, 17);
      txt("B", 152, 21, 17);
      txt("C", 280, 133, 17);
    } else {
      line(49, 85, 310, 85, "#475343", 2.4);
      for (const x of [75, 285]) {
        c.beginPath();
        c.fillStyle = "#485348";
        c.arc(x, 85, 3.5, 0, Math.PI * 2);
        c.fill();
      }
      txt("A", 61, 111, 20);
      txt("B", 288, 111, 20);
      if (!["geo", "pending"].includes(mode)) {
        curve([201, 22, 169, 42, 157, 69, 159, 87], "#4e699f", 3.3);
        curve([159, 87, 160, 112, 177, 125, 201, 142], "#4e699f", 3.3);
        curve([161, 24, 196, 46, 205, 70, 202, 88], "#a56445", 3);
        curve([202, 88, 201, 108, 184, 129, 159, 142], "#a56445", 3);
        line(180, 9, 180, 145, "#40588a", 3.2);
        line(180, 75, 191, 75, "#7286a9");
        line(191, 75, 191, 85, "#7286a9");
        txt("M", 185, 105, 14, "#49618c", "italic");
      }
      if (mode === "marked" || mode === "markDraft") {
        c.beginPath();
        c.strokeStyle = "#bb6559";
        c.lineWidth = 3;
        c.ellipse(181, 84, 31, 21, -0.19, 0, Math.PI * 2);
        c.stroke();
      }
    }
  } else {
    const t =
      mode === "answerCrop" ? "3x = 15" : quiz ? "2x + 3 = 17" : "3x + 4 = 19";
    txt(t, 15, 37, 31, "#2b352e", "italic");
    if (
      [
        "algebraInk",
        "written",
        "boxed",
        "submitted",
        "wrong",
        "wrongDad",
        "retry",
        "answerCrop",
      ].includes(mode)
    ) {
      const wrong = mode === "wrong" || mode === "wrongDad",
        first = quiz ? (wrong ? "2x = 20" : "2x = 14") : "3x = 15",
        ans = quiz ? (wrong ? "x = 10" : "x = 7") : "x = 5";
      c.save();
      c.translate(40, 0);
      c.rotate(-0.035);
      txt(first, 4, 82, 24, "#455e90", "italic");
      txt(ans, 32, 120, 25, "#455e90", "italic");
      c.restore();
      if (wrong) {
        c.beginPath();
        c.ellipse(88, 72, 54, 18, -0.05, 0, Math.PI * 2);
        c.lineWidth = 3;
        c.strokeStyle = "#c86a56";
        c.stroke();
      }
      if (mode === "boxed") {
        c.strokeStyle = "#486393";
        c.lineWidth = 2;
        c.strokeRect(65, 95, 81, 30);
      }
    }
  }
  if (canvas.dataset.ink === "yes") {
    for (const stroke of points[current.id] || []) {
      c.beginPath();
      c.lineWidth = 2.6;
      c.strokeStyle = "#334e91";
      stroke.forEach(([x, y], i) =>
        i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h),
      );
      if (stroke.length === 1) {
        c.arc(stroke[0][0] * w, stroke[0][1] * h, 1, 0, Math.PI * 2);
      }
      c.stroke();
    }
  }
}
function canvases(root = document) {
  root.querySelectorAll("canvas.exercise").forEach((el) => {
    plot(el);
    if (!el.classList.contains("writable")) return;
    let stroke = null;
    const point = (e) => {
      const r = el.getBoundingClientRect();
      return [
        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      ];
    };
    const redraw = () =>
      document.querySelectorAll('canvas[data-ink="yes"]').forEach(plot);
    el.onpointerdown = (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      stroke = [point(e)];
      (points[current.id] ??= []).push(stroke);
      if ($("eraseInk")) $("eraseInk").disabled = false;
      redraw();
    };
    el.onpointermove = (e) => {
      if (stroke && el.hasPointerCapture(e.pointerId)) {
        stroke.push(point(e));
        redraw();
      }
    };
    el.onpointercancel =
      el.onlostpointercapture =
      el.onpointerup =
        () => {
          stroke = null;
        };
  });
}
function count(id) {
  return notes.filter((n) => n.scene === id).length;
}
function menu(inSheet = false) {
  return groups
    .map(
      (g) =>
        "<details " +
        (g.id === current.group ? "open" : "") +
        '><summary><span class="group-icon" aria-hidden="true">' +
        g.symbol +
        "</span>" +
        g.title +
        '<span class="chev">⌄</span></summary>' +
        scenes
          .filter((s) => s.group === g.id)
          .map(
            (s) =>
              '<button class="action-link" data-scene="' +
              s.id +
              '" ' +
              (s.id === current.id ? 'aria-current="step"' : "") +
              ">" +
              s.title +
              (count(s.id)
                ? '<span class="small-note">' + count(s.id) + "</span>"
                : "") +
              "</button>",
          )
          .join("") +
        "</details>",
    )
    .join("");
}
const draftId = () => [current.id, step, scope].join(".");
function saveDraft() {
  if (!current || editing) return;
  const key = draftId();
  if ($("note").value) drafts[key] = $("note").value;
  else delete drafts[key];
  persist(draftKey, drafts);
}
function restoreDraft() {
  editing = null;
  $("note").value = drafts[draftId()] || "";
  $("save").textContent = "의견 저장";
  document
    .querySelectorAll("[data-for]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.for === scope)),
    );
}
function row(n, global = false) {
  const s = scenes.find((x) => x.id === n.scene);
  if (!s) return "";
  return (
    '<article class="entry"><header><strong>' +
    esc(n.scope) +
    "</strong><span>" +
    (global ? esc(s.title) + " · " : "") +
    esc(n.state) +
    '</span><button data-edit="' +
    esc(n.id) +
    '" aria-label="코멘트 수정">수정</button><button data-delete="' +
    esc(n.id) +
    '" aria-label="코멘트 삭제">삭제</button></header><p>' +
    esc(n.text) +
    "</p></article>"
  );
}
function refreshNotes() {
  const arr = notes.filter((n) => n.scene === current.id);
  $("noteCount").textContent = notes.length;
  $("savedCount").textContent = arr.length ? arr.length + "개" : "";
  $("sceneNotes").innerHTML = arr.map((n) => row(n)).join("");
  $("railNav").innerHTML = menu();
}
function paint() {
  $("title").textContent = current.title;
  $("intro").textContent = current.intro;
  $("groupName").textContent = groupsById.get(current.group).title;
  $("sceneCount").textContent =
    String(appOrder.get(current.id)).padStart(2, "0") + " / " + scenes.length;
  $("totalScenes").textContent = scenes.length + "개";
  const state = current.states[step];
  $("kidStage").innerHTML = view(state[1], "kid");
  $("dadStage").innerHTML = view(state[2], "dad");
  $("kidCaption").textContent = current.kid;
  $("dadCaption").textContent = current.dad;
  $("toggles").innerHTML =
    (current.states.length > 1
      ? current.states
          .map(
            (s, i) =>
              '<button data-step="' +
              i +
              '" aria-pressed="' +
              (i === step) +
              '">' +
              esc(s[0]) +
              "</button>",
          )
          .join("")
      : "") +
    (["write", "quiz-write"].includes(current.id)
      ? '<button id="eraseInk" ' +
        (points[current.id]?.length ? "" : "disabled") +
        ' aria-label="내가 그린 예시 획 지우기">내 선 지우기</button>'
      : "");
  $("prev").disabled = appOrder.get(current.id) === 1;
  $("next").disabled = appOrder.get(current.id) === scenes.length;
  canvases();
  refreshNotes();
  restoreDraft();
  document.title = current.title + " · 마스터노트 화면 리뷰";
}
function gotoScene(id, which, scroll = true) {
  const s =
    scenes.find((x) => x.id === id) || scenes.find((x) => x.id === "switch");
  const idx = Number.isInteger(which) && s.states[which] ? which : s.initial;
  if (current) saveDraft();
  current = s;
  step = idx;
  scope = "공통";
  paint();
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
}
function readHash() {
  const [id, n] = location.hash.slice(1).split("/");
  gotoScene(id, n === undefined ? undefined : Number(n), !!current);
}
function go(id) {
  if (modal) closeSheet();
  if (id === current.id) {
    window.scrollTo(0, 0);
    return;
  }
  location.hash = id;
}
function setStep(i) {
  if (!current.states[i]) return;
  saveDraft();
  step = i;
  history.replaceState(null, "", "#" + current.id + "/" + i);
  paint();
}
function resetDialog() {
  if (!$("sheet").open) {
    activeTrigger = document.activeElement;
    $("sheet").showModal();
  }
  $("sheet").scrollTop = 0;
}
function closeSheet() {
  if ($("sheet").open) $("sheet").close();
}
$("sheet").addEventListener("close", () => {
  modal = "";
  zoomRole = "";
  $("sheetBody").innerHTML = "";
  if (activeTrigger?.isConnected) activeTrigger.focus({ preventScroll: true });
});
$("sheet").addEventListener("click", (e) => {
  if (e.target === $("sheet")) {
    const r = $("sheet").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeSheet();
  }
});
function catalog() {
  modal = "catalog";
  $("sheetTitle").textContent = "행동 목록 · " + scenes.length + "개";
  $("sheetBody").innerHTML =
    '<nav class="catalog" aria-label="행동 선택">' + menu(true) + "</nav>";
  resetDialog();
}
function zoom(role) {
  modal = "zoom";
  zoomRole = role;
  const kid = role === "kid",
    state = current.states[step];
  $("sheetTitle").textContent =
    (kid ? "서아 · Tab S11" : "아빠 · S23 Ultra") + " 화면";
  $("sheetBody").innerHTML =
    '<div class="single ' +
    (kid ? "kid" : "dad") +
    '"><div class="stage">' +
    view(state[kid ? 1 : 2], role) +
    '</div><p class="role-caption">' +
    esc(kid ? current.kid : current.dad) +
    "</p></div>";
  resetDialog();
  canvases($("sheetBody"));
}
function asText() {
  return (
    "마스터노트 화면 리뷰\n\n" +
    notes
      .map((n) => {
        const s = scenes.find((x) => x.id === n.scene);
        return (
          "[" +
          (s?.title || "장면") +
          " / " +
          n.state +
          " / " +
          n.scope +
          "]\n" +
          n.text
        );
      })
      .join("\n\n")
  );
}
function allNotes() {
  modal = "notes";
  $("sheetTitle").textContent = "내 코멘트 · " + notes.length + "개";
  $("sheetBody").innerHTML =
    '<p class="sheethelp">이 브라우저에 저장한 의견입니다. 복사해서 이 채팅에 붙이거나 비공개 개발 저장소로 보낼 수 있어요.</p><div class="note-list">' +
    (notes.length
      ? notes.map((n) => row(n, true)).join("")
      : '<div class="empty">아직 저장한 코멘트가 없습니다.</div>') +
    "</div>" +
    (notes.length
      ? '<div class="note-actions"><button class="control" id="copyAll">모아서 복사</button><button class="outline" id="shareAll">공유</button><button class="outline" id="issue">GitHub에 보내기</button></div>'
      : "");
  resetDialog();
}
function fallbackText(text) {
  let f = $("shareText");
  if (!f) {
    f = document.createElement("textarea");
    f.id = "shareText";
    f.className = "share-fallback";
    f.readOnly = true;
    f.setAttribute("aria-label", "복사할 전체 의견");
    $("sheetBody").append(f);
  }
  f.value = text;
  f.select();
  notify("선택한 의견을 복사해 주세요");
}
async function copyAll() {
  const s = asText();
  try {
    await navigator.clipboard.writeText(s);
    notify("전체 의견을 복사했어요");
  } catch {
    fallbackText(s);
  }
}
function saveNote() {
  const text = $("note").value.trim();
  if (!text) {
    $("note").focus();
    notify("의견을 입력해 주세요");
    return;
  }
  const id =
    editing ||
    window.crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const n = {
    id,
    scene: current.id,
    step,
    state: current.states[step][0],
    scope,
    text,
  };
  const old = notes.findIndex((a) => a.id === id);
  const next = [...notes];
  if (old < 0) next.push(n);
  else next[old] = n;
  const durable = persist(noteKey, next);
  notes = next;
  delete drafts[draftId()];
  persist(draftKey, drafts);
  editing = null;
  $("note").value = "";
  $("save").textContent = "의견 저장";
  refreshNotes();
  notify(
    durable
      ? "이 장면에 의견을 저장했어요"
      : "저장 공간을 쓸 수 없어 이 화면에만 보관합니다",
  );
}
function editNote(id) {
  const n = notes.find((i) => i.id === id);
  if (!n) return;
  activeTrigger = null;
  closeSheet();
  if (current) saveDraft();
  history.replaceState(null, "", "#" + n.scene + "/" + n.step);
  gotoScene(n.scene, n.step, false);
  scope = n.scope;
  restoreDraft();
  editing = id;
  $("note").value = n.text;
  $("save").textContent = "수정 저장";
  $("note").focus();
}
function deleteNote(id) {
  if (!confirm("이 코멘트를 삭제할까요?")) return;
  notes = notes.filter((n) => n.id !== id);
  persist(noteKey, notes);
  if (editing === id) restoreDraft();
  refreshNotes();
  if (modal === "notes") allNotes();
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.scene) {
    go(b.dataset.scene);
    return;
  }
  if (b.dataset.step !== undefined) {
    setStep(+b.dataset.step);
    return;
  }
  if (b.dataset.zoom) {
    zoom(b.dataset.zoom);
    return;
  }
  if (b.dataset.for) {
    if (editing) {
      scope = b.dataset.for;
      document
        .querySelectorAll("[data-for]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    } else {
      saveDraft();
      scope = b.dataset.for;
      restoreDraft();
    }
    return;
  }
  if (b.dataset.edit) {
    editNote(b.dataset.edit);
    return;
  }
  if (b.dataset.delete) {
    deleteNote(b.dataset.delete);
    return;
  }
  switch (b.id) {
    case "allNotes":
      allNotes();
      break;
    case "close":
      closeSheet();
      break;
    case "catalogBtn":
      catalog();
      break;
    case "save":
      saveNote();
      break;
    case "prev":
    case "next": {
      const s =
        scenes[appOrder.get(current.id) - 1 + (b.id === "next" ? 1 : -1)];
      if (s) go(s.id);
      break;
    }
    case "copyAll":
      await copyAll();
      break;
    case "shareAll":
      if (navigator.share) {
        try {
          await navigator.share({
            title: "마스터노트 화면 리뷰",
            text: asText(),
          });
        } catch (err) {
          if (err.name !== "AbortError") await copyAll();
        }
      } else {
        await copyAll();
      }
      break;
    case "issue": {
      const u = new URL(
        "https://github.com/jinhoofkepco/MasterNote/issues/new",
      );
      u.searchParams.set("title", "마스터노트 두 화면 목업 의견");
      u.searchParams.set("body", asText());
      if (u.href.length > 7000) {
        await copyAll();
        u.searchParams.delete("body");
        notify("긴 의견은 복사한 뒤 GitHub에 붙여 주세요");
      }
      window.open(u.href, "_blank", "noopener,noreferrer");
      break;
    }
    case "eraseInk":
      points[current.id] = [];
      document.querySelectorAll('canvas[data-ink="yes"]').forEach(plot);
      b.disabled = true;
      break;
  }
});
$("note").addEventListener("input", saveDraft);
window.addEventListener("hashchange", readHash);
readHash();
