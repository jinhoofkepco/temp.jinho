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
const typeNames = ["일차방정식", "괄호 풀기"];
const typePages = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
];
function addQuestions(type) {
  const lastPage = typePages.reduce(
    (last, pages) => Math.max(last, pages.at(-1)),
    0,
  );
  for (let next = 1; next <= 5; next++) typePages[type].push(lastPage + next);
}
const firstQuestion = { type: 0, number: 1 };
let selections = { kid: firstQuestion, dad: firstQuestion };
let readerModes = {};
let readerLayers = {};
let feedbackTool = "";
const feedback = new Map();

function question(role = "dad") {
  const { type, number } = selections[role];
  const page = typePages[type][number - 1];
  const a = 2 + ((number - 1) % 4);
  const b = 3 + ((number - 1) % 3);
  const answer = 6 + number;
  const equation =
    type === 0
      ? a + "x + " + b + " = " + (a * answer + b)
      : a + "(x + " + b + ") = " + a * (answer + b);
  const working =
    type === 0 ? a + "x = " + a * answer : "x + " + b + " = " + (answer + b);
  return {
    type,
    number,
    page,
    equation,
    working,
    answer,
    name: typeNames[type],
  };
}

function groupList(kid) {
  const rows = typeNames
    .map((name, type) => {
      const count = typePages[type].length;
      const chips = Array.from({ length: count }, (_, idx) => {
        const n = idx + 1;
        return (
          '<button class="number-chip" data-type="' +
          type +
          '" data-question="' +
          n +
          '" aria-label="' +
          name +
          " " +
          n +
          '번 열기">' +
          n +
          "</button>"
        );
      }).join("");
      const add = kid
        ? ""
        : '<button class="batch-add" data-extend="' +
          type +
          '" aria-label="' +
          name +
          ' 5문제 추가">+5</button>';
      return (
        '<li class="type-row"><strong>' +
        name +
        '</strong><div class="number-track" aria-label="' +
        name +
        ' 문제 번호">' +
        chips +
        "</div>" +
        add +
        "</li>"
      );
    })
    .join("");
  return (
    '<div class="pagespaper type-paper"><div class="book-tabs"><button data-booktab="pages">본문</button><b>추가문제</b></div><ul class="type-list">' +
    rows +
    "</ul></div>"
  );
}

function pages(mode, kid) {
  if (mode !== "pages") return groupList(kid);
  const tiles = [47, 48, 49, 50, 51, 52]
    .map(
      (n) =>
        '<div class="tile ' +
        (n === 48 ? "selected" : "") +
        '">' +
        n +
        "쪽<small>" +
        (n === 48 ? "풀이 중" : "미시작") +
        "</small></div>",
    )
    .join("");
  return (
    '<div class="pagespaper"><div class="pagesplit"><div class="mini-cover">' +
    cover(0) +
    '</div><div class="minipages"><div class="book-tabs"><b>본문</b><button data-booktab="variants">추가문제</button></div><div class="gridlabel">최근 필기</div><div class="mini-tabs"><b>48쪽</b><span>36쪽</span></div><div class="gridlabel">전체 쪽</div><div class="pgrid">' +
    tiles +
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
      control("generate", "같은 유형 5문제 만들기", "같은 유형 추가문제 생성"),
    ),
  generating: () =>
    panel(
      "",
      "변형퀴즈",
      "5문제 만드는 중",
      "일차방정식 · 계산 조건과 숫자를 검산합니다.",
      '<div class="imageline"></div>',
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
function control(action, label, title, extra = "") {
  return (
    '<button class="reader-action ' +
    extra +
    '" data-reader="' +
    action +
    '" aria-label="' +
    title +
    '" title="' +
    title +
    '">' +
    label +
    "</button>"
  );
}
function strip(mode, kid, link) {
  const q = quizSet.has(mode);
  const home = control("library", "▤", "교재 페이지로 돌아가기");
  const live =
    '<span class="transport-dot ' +
    (link === "오프라인"
      ? "is-offline"
      : link === "수신 대기"
        ? "is-pending"
        : "") +
    '" title="' +
    link +
    '" aria-label="' +
    link +
    '"></span>';
  const attempt = mode === "retry" ? "2회" : "1회";
  const history = '<span class="attempt-label">' + attempt + "</span>";
  const actions = kid
    ? history +
      control("construction", "작도", "페이지 작도 메모 열기") +
      control("submit", "제출", "현재 페이지 제출", "filled")
    : control(
        q ? "print" : "capture",
        "인쇄",
        q ? "현재 문제 인쇄" : "문제 캡처 후 인쇄 요청",
        q ? "print-action" : "",
      ) +
      control("key", "답", "현재 문제 정답 보기") +
      control("grade", "채점", "정오답·첨삭 도구") +
      control("publish", "발행", "첨삭 발행", "filled");
  return (
    '<nav class="reader-strip" aria-label="풀이 상단 메뉴">' +
    home +
    live +
    actions +
    control("more", "⋯", "풀이 메뉴 더 보기") +
    "</nav>"
  );
}
function pageKey(mode, role) {
  if (quizSet.has(mode))
    return "extra-" + question(role).page + "-" + (mode === "retry" ? 2 : 1);
  return (
    (geoSet.has(mode) ? "lower-" : "upper-") +
    (mode === "browse" ? 47 : 48) +
    "-1"
  );
}
function responseFor(mode, role) {
  const key = pageKey(mode, role);
  if (!feedback.has(key)) feedback.set(key, { pending: [], sent: [] });
  return feedback.get(key);
}
function gradeLayer() {
  return panel(
    "",
    "채점 · 현재 회차",
    "풀이 위에 표시",
    "",
    "<div class='grade-palette'>" +
      control("mark-o", "○ 정답", "정답 표시 선택") +
      control("mark-x", "× 오답", "오답 표시 선택") +
      control("mark-pen", "첨삭 펜", "첨삭 필기 선택") +
      "</div>" +
      control("close", "돌아가기", "풀이로 돌아가기"),
  );
}
function printView(sent) {
  const q = question();
  return (
    '<div class="print-view"><div class="print-heading"><span>Epson L805</span><b>' +
    (sent ? "인쇄 요청 완료" : "인쇄 미리보기") +
    '</b></div><div class="print-page"><small>황소 프라임 중1 상 · 추가 ' +
    q.page +
    "쪽</small><strong>" +
    q.name +
    " · " +
    q.number +
    "번</strong><p>x의 값을 구하세요.</p><em>" +
    q.equation +
    '</em></div><div class="print-controls">' +
    control("close", "닫기", "인쇄 화면 닫기") +
    (sent
      ? "<b>1장 요청됨</b>"
      : control("send-print", "1장 인쇄", "이 문제 한 장 인쇄", "filled")) +
    "</div></div>"
  );
}
function readerLayer(layer, mode, kid) {
  if (layer === "proof" || layer === "sent") return printView(layer === "sent");
  if (layer === "grade") return gradeLayer();
  const back = control("close", "닫기", "풀이로 돌아가기");
  if (layer === "key") {
    const q = question();
    const body = quizSet.has(mode)
      ? [q.equation, q.working + "　→　x = " + q.answer]
      : geoSet.has(mode)
        ? ["수직이등분선 작도", "AB의 중점을 지나 AB와 수직인 직선"]
        : ["3x + 4 = 19", "3x = 15　→　x = 5"];
    return panel(
      "",
      "선생님 · 답",
      "정답과 풀이",
      body[0],
      opt(body[1], "blue") + back,
    );
  }
  if (layer === "more")
    return panel(
      "",
      "풀이 메뉴",
      "현재 페이지",
      "",
      '<div class="overflow-actions">' +
        (kid
          ? control("status", "전송 상태", "전송 상태 보기")
          : control("construction", "작도", "작도 메모 열기") +
            control("gpt", "GPT", "GPT 페이지 설명") +
            control("status", "전송 상태", "전송 상태 보기")) +
        "</div>" +
        back,
    );
  if (layer === "capture")
    return panel(
      "",
      "본문 · 캡처",
      "문제 영역 선택",
      "원문의 식과 그림을 함께 고릅니다.",
      control("generate", "추가문제 만들기", "추가문제 생성 보기") +
        control("paper-request", "문제 만들고 인쇄", "캡처 인쇄 요청 보기") +
        back,
    );
  if (layer === "paper-request" || layer === "dictate")
    return panel(
      "",
      "Mac 인쇄 요청",
      "문제 만들고 인쇄",
      "<textarea class='capture-prompt' aria-label='인쇄 요청 문구'>" +
        (layer === "dictate"
          ? ""
          : "숫자만 바꿔서 문제 만들고 바로 인쇄해줘.") +
        "</textarea>",
      control("dictate", "새로 받아쓰기", "새 요청 문구 예시") +
        control("paper-sent", "요청 보내기", "예시 캡처 인쇄 요청 보내기") +
        back,
    );
  if (layer === "paper-sent")
    return panel(
      "",
      "Mac 인쇄",
      "요청을 보냈어요",
      "Epson L805 · 문제지",
      back,
    );
  if (layer === "submitted") {
    const label = quizSet.has(mode)
      ? question("kid").name + " · " + question("kid").number + "번"
      : "본문 " + (mode === "browse" ? 47 : 48) + "쪽";
    return panel(
      "",
      label,
      "제출 완료",
      quizSet.has(mode)
        ? "풀이 시간과 답을 확인합니다."
        : "현재 회차의 풀이를 제출했습니다.",
      back,
    );
  }
  const details = {
    construction: ["작도 메모", "이 페이지의 작도 공간"],
    status: ["전송 상태", mode === "geoTel" ? "Telegram" : "현재 문제집 연결"],
    gpt: ["GPT 페이지 설명", "현재 페이지의 문제 설명"],
  };
  return panel("", "현재 페이지", ...details[layer], back);
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
        ? question(kid ? "kid" : "dad").name
        : "식의 값 구하기";
  const penMode = !["submitted", "answerCrop", "selection"].includes(mode);
  const coord = geo ? "360,150" : "360,140";
  const canvas =
    '<div class="plot-space"><div class="plot-content ' +
    (geo ? "geometry" : "algebra") +
    '"><canvas class="exercise' +
    ((penMode && kid) || (!kid && feedbackTool) ? " writable" : "") +
    '" data-role="' +
    (kid ? "kid" : "dad") +
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
    (q
      ? "추가 " + question(kid ? "kid" : "dad").page + "쪽"
      : "본문 " + (browsing ? "47" : "48") + "쪽") +
    '</span></div><div class="qnumber">' +
    (geo
      ? "개념탐구 " + (browsing ? "3" : "4")
      : q
        ? String(question(kid ? "kid" : "dad").number).padStart(2, "0")
        : "예제 2") +
    '</div><div class="problem">' +
    heading +
    "</div>" +
    canvas +
    (mode === "selection" || mode === "answerCrop"
      ? '<div class="selection"></div>'
      : "") +
    "</div>" +
    (!kid && feedbackTool
      ? bar(
          feedbackTool === "pen"
            ? "첨삭한 뒤 발행"
            : "표시할 위치를 누른 뒤 발행",
          "check",
        )
      : !kid && responseFor(mode, "dad").submitted
        ? bar("1회차 제출됨", "check")
        : note[mode]
          ? bar(...note[mode])
          : "")
  );
}
function view(mode, role) {
  mode = readerModes[role] || mode;
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
  const fixedPrint = ["proof", "sent"].includes(mode);
  const source = fixedPrint ? "written" : mode;
  const layer = readerLayers[role] || (fixedPrint ? mode : "");
  const reader = !isShelf && !pg && !panels[mode];
  const header = reader
    ? strip(source, kid, link)
    : '<div class="device-head"><span class="backmark">‹</span><b>' +
      h +
      '</b><span class="device-state">' +
      top +
      "</span></div>";
  const body = layer
    ? readerLayer(layer, source, kid)
    : isShelf
      ? shelf(mode)
      : pg
        ? pages(mode, kid)
        : panels[mode]
          ? panels[mode]()
          : paper(mode, kid);
  return (
    '<div class="device ' +
    (kid ? "tab" : "phone") +
    '" data-role="' +
    role +
    '" data-mode="' +
    source +
    '">' +
    header +
    '<div class="device-body">' +
    body +
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
  const role = canvas.dataset.role;
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
      mode === "answerCrop"
        ? "3x = 15"
        : quiz
          ? question(role).equation
          : "3x + 4 = 19";
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
        first = quiz ? (wrong ? "2x = 20" : question(role).working) : "3x = 15",
        ans = quiz
          ? wrong
            ? "x = 10"
            : "x = " + question(role).answer
          : "x = 5";
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
    for (const stroke of points[pageKey(mode, role)] || []) {
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
  const marks = responseFor(mode, role);
  const visible =
    role === "dad" ? marks.sent.concat(marks.pending) : marks.sent;
  for (const mark of visible) {
    const [x, y] = mark.points[0];
    if (mark.tool === "o") {
      c.beginPath();
      c.strokeStyle = "#b33f3a";
      c.lineWidth = 3;
      c.ellipse(x * w, y * h, 17, 14, -0.12, 0, 2 * Math.PI);
      c.stroke();
    } else if (mark.tool === "x") {
      line(x * w - 11, y * h - 11, x * w + 11, y * h + 11, "#b33f3a", 3);
      line(x * w + 11, y * h - 11, x * w - 11, y * h + 11, "#b33f3a", 3);
    } else {
      c.beginPath();
      c.strokeStyle = "#b33f3a";
      c.lineWidth = 3;
      c.moveTo(x * w, y * h);
      for (const [px, py] of mark.points) c.lineTo(px * w, py * h);
      if (mark.points.length === 1) c.lineTo(x * w + 0.5, y * h + 0.5);
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
    const teacher = el.dataset.role === "dad";
    const redraw = () =>
      document.querySelectorAll("canvas.exercise").forEach(plot);
    el.onpointerdown = (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      stroke = [point(e)];
      if (teacher)
        responseFor(el.dataset.mode, "dad").pending.push({
          tool: feedbackTool,
          points: stroke,
        });
      else {
        (points[pageKey(el.dataset.mode, "kid")] ??= []).push(stroke);
        if ($("eraseInk")) $("eraseInk").disabled = false;
      }
      redraw();
    };
    el.onpointermove = (e) => {
      if (
        stroke &&
        el.hasPointerCapture(e.pointerId) &&
        (!teacher || feedbackTool === "pen")
      ) {
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
function repaintReaders() {
  const state = current.states[step];
  $("kidStage").innerHTML = view(state[1], "kid");
  $("dadStage").innerHTML = view(state[2], "dad");
  canvases();
  if (modal === "zoom" && zoomRole) zoom(zoomRole);
}

function clearReaderMenus() {
  readerLayers = {};
  readerModes = {};
  feedbackTool = "";
}

function readerClick(button) {
  const device = button.closest(".device");
  if (!device) return false;
  const role = device.dataset.role;
  const mode = device.dataset.mode;
  const kid = role === "kid";
  const a = button.dataset.reader;
  if (button.dataset.question) {
    const selected = {
      type: Number(button.dataset.type),
      number: Number(button.dataset.question),
    };
    selections[role] = selected;
    readerModes[role] = "quiz";
    if (kid) {
      selections.dad = selected;
      readerModes.dad = "quiz";
      delete readerLayers.dad;
    }
    delete readerLayers[role];
    feedbackTool = "";
  } else if (button.dataset.extend !== undefined) {
    const type = Number(button.dataset.extend);
    if (kid) return true;
    addQuestions(type);
    notify(typeNames[type] + "에 5문제를 추가했어요");
  } else if (button.dataset.booktab) {
    readerModes[role] = button.dataset.booktab;
    delete readerLayers[role];
  } else if (!a) return false;
  else if (a === "library") {
    readerModes[role] = quizSet.has(mode) ? "variants" : "pages";
    delete readerLayers[role];
  } else if (a === "mark-o" || a === "mark-x" || a === "mark-pen") {
    feedbackTool = a.slice(5);
    delete readerLayers.dad;
  } else if (a === "publish") {
    const group = responseFor(mode, role);
    if (!group.pending.length) {
      readerLayers.dad = "grade";
      notify("먼저 풀이에 표시해 주세요");
    } else {
      group.sent.push(...group.pending);
      group.pending = [];
      feedbackTool = "";
      delete readerLayers.dad;
      notify("이 쪽의 첨삭을 발행했어요");
    }
  } else if (a === "close") {
    if (current.id === "print" && step !== 0) {
      setStep(0);
      if (modal === "zoom") zoom(zoomRole);
      return true;
    }
    delete readerLayers[role];
    if (["proof", "sent"].includes(current.states[step][2]))
      readerModes[role] = "written";
  } else if (a === "print" || a === "send-print") {
    if (current.id === "print") {
      setStep(a === "print" ? 1 : 2);
      if (modal === "zoom") zoom(zoomRole);
      return true;
    }
    readerLayers.dad = a === "print" ? "proof" : "sent";
  } else if (a === "generate") {
    go("generate");
    return true;
  } else if (a === "submit") {
    responseFor(mode, "kid").submitted = true;
    if (current.id === "submit") {
      setStep(1);
      if (modal === "zoom") zoom(zoomRole);
      return true;
    }
    readerLayers.kid = "submitted";
  } else readerLayers[role] = a;
  repaintReaders();
  return true;
}

function paint() {
  if (current.states[step].includes("ten") && typePages[0].length < 10)
    addQuestions(0);
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
        (points[pageKey(readerModes.kid || state[1], "kid")]?.length
          ? ""
          : "disabled") +
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
  clearReaderMenus();
  if (!["types", "generate", "variant-pages", "print"].includes(s.id))
    selections = { kid: firstQuestion, dad: firstQuestion };
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
  clearReaderMenus();
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
  if (readerClick(b)) return;
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
      points[pageKey(readerModes.kid || current.states[step][1], "kid")] = [];
      document.querySelectorAll('canvas[data-ink="yes"]').forEach(plot);
      b.disabled = true;
      break;
  }
});
$("note").addEventListener("input", saveDraft);
window.addEventListener("hashchange", readHash);
readHash();
