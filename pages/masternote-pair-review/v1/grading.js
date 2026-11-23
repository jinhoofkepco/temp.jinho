"use strict";
const $ = (id) => document.getElementById(id);
const API = "https://jhm-macbookpro.tail63c1a8.ts.net:10000/mn-grade-review";
const params = new URLSearchParams(location.hash.slice(1));
function read(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, val) {
  try {
    if (val === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, val);
  } catch {}
}
const token = params.get("k") || read("mn.grade.review.key");
const room = params.get("r") || read("mn.grade.room");
if (params.has("r")) write("mn.grade.room", room);
const moveToPrivateScreen = Boolean(
  token && location.origin !== new URL(API).origin,
);
if (moveToPrivateScreen)
  location.replace(
    API +
      "/screen/#k=" +
      encodeURIComponent(token) +
      (room ? "&r=" + encodeURIComponent(room) : ""),
  );
if (params.has("k") && !moveToPrivateScreen) {
  write("mn.grade.review.key", token);
  history.replaceState(
    null,
    "",
    location.pathname + location.search + "#review",
  );
}
const prefix = token ? "mn.grade.live." : "mn.grade.preview.";
let sample = null,
  ready = false,
  goal = 120,
  started = Date.now(),
  stopped = null,
  pendingId = null,
  attempt = null,
  revision = 0,
  generation = 0,
  waiting = false;
let childInk = [],
  parentInk = [],
  verdict = "",
  pen = false,
  editing = false,
  sending = false;
let submittedAt = null;
const labels = {
  correct: "○ 정답",
  wrong: "다시 풀기",
  incomplete: "풀이 보완",
  unreadable: "판독 어려움",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const elapsed = () =>
  stopped === null ? Math.max(0, (Date.now() - started) / 1000) : stopped;
function formatTime(s) {
  const n = Math.floor(s);
  return (
    String(Math.floor(n / 60)).padStart(2, "0") +
    ":" +
    String(n % 60).padStart(2, "0")
  );
}
const rod = (on) => '<i class="rod' + (on ? " lit" : "") + '"></i>';
function paintTime() {
  const s = elapsed(),
    ticks = Math.floor(s / 10),
    min = Math.floor(ticks / 6),
    rest = ticks % 6;
  for (const el of document.querySelectorAll("[data-clock]")) {
    const dad = el.dataset.clock === "dad";
    const fadeTime =
      stopped !== null && submittedAt !== null && s >= (goal * 2) / 3
        ? s + (Date.now() - submittedAt) / 1000
        : s;
    const opacity = dad
      ? 1
      : Math.max(0, Math.min(1, 1 - (fadeTime - (goal * 2) / 3) / 10));
    el.style.opacity = opacity;
    el.style.visibility = opacity === 0 ? "hidden" : "visible";
    el.setAttribute("aria-hidden", String(opacity === 0));
    const stamp = ticks + "/" + (dad ? Math.floor(s) : "");
    if (el.dataset.stamp === stamp) continue;
    el.dataset.stamp = stamp;
    const pack =
      '<span class="rod-pack" aria-hidden="true">' +
      rod(true).repeat(6) +
      "<b>1분</b></span>";
    const packs =
      min <= 2
        ? pack.repeat(min)
        : pack + '<small class="times">×' + min + "</small>";
    el.innerHTML =
      packs +
      '<span class="rod-unit" aria-hidden="true">' +
      Array.from({ length: 6 }, (_, i) => rod(i < rest)).join("") +
      "</span>" +
      (dad ? "<time>" + formatTime(s) + "</time>" : "");
    el.setAttribute(
      "aria-label",
      dad ? "경과 " + formatTime(s) : min + "분 " + rest * 10 + "초",
    );
  }
}
setInterval(paintTime, 120);
function note(text) {
  $("hint").textContent = text;
}
async function api(path, method = "GET", body, raw = false) {
  const options = {
    method,
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(37000),
  };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const r = await fetch(API + path, options);
  if (!r.ok) {
    const error = await r.json().catch(() => null);
    throw new Error(error?.error || "연결 오류 " + r.status);
  }
  return raw ? r.blob() : r.json();
}
async function bitmap(blob) {
  return createImageBitmap(blob);
}
function publicPaper(c) {
  c.fillStyle = "#25362b";
  c.font = "bold 30px system-ui";
  c.fillText("점 P를 지나 직선 ℓ에 수직인 선을 그리세요.", 24, 48);
  c.strokeStyle = "#474c42";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(215, 269);
  c.lineTo(683, 269);
  c.stroke();
  c.fillStyle = "#263a2e";
  c.beginPath();
  c.arc(428, 108, 5, 0, Math.PI * 2);
  c.fill();
  c.font = "italic 24px Georgia";
  c.fillText("P", 441, 111);
  c.fillText("ℓ", 692, 269);
}
function stroke(c, points, color) {
  if (!points.length) return;
  c.strokeStyle = color;
  c.lineWidth = 3.6;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  const [x, y] = points[0];
  c.moveTo(x * 910, y * 348);
  for (const [px, py] of points) c.lineTo(px * 910, py * 348);
  if (points.length === 1) c.lineTo(x * 910 + 0.6, y * 348 + 0.6);
  c.stroke();
}
function draw(canvas, role, forSubmission = false) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 910, 348);
  c.fillStyle = "white";
  c.fillRect(0, 0, 910, 348);
  if (sample) c.drawImage(sample, 0, 0, 910, 348);
  else publicPaper(c);
  childInk.forEach((p) => stroke(c, p, "#314568"));
  if (forSubmission) return;
  const finished = attempt?.status === "father";
  const marks = finished
    ? attempt.result?.ink
    : role === "dad"
      ? parentInk
      : [];
  (marks || []).forEach((p) => stroke(c, p, "#c04e35"));
  if (attempt?.status === "ai") {
    for (const r of attempt.result?.regions || []) {
      const x1 = r.p1.x * 9.1,
        x2 = r.p2.x * 9.1,
        y1 = r.p1.y * 3.48,
        y2 = r.p2.y * 3.48,
        minor = r.radius * 3.48;
      c.beginPath();
      c.strokeStyle = "#b95745";
      c.lineWidth = 3;
      c.ellipse(
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        Math.hypot(Math.hypot(x2 - x1, y2 - y1) / 2, minor),
        minor,
        Math.atan2(y2 - y1, x2 - x1),
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
  }
}
function paintPapers() {
  document
    .querySelectorAll("canvas[data-paper]")
    .forEach((el) => draw(el, el.dataset.paper));
}
function bindCanvas(el) {
  let currentStroke = null,
    pointer = null;
  const role = el.dataset.paper;
  const coord = (e) => {
    const r = el.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  };
  el.onpointerdown = (e) => {
    if (!ready || !e.isPrimary || e.button !== 0 || pointer !== null) return;
    if (role === "kid" ? !!pendingId : !(pen && editing && !sending)) return;
    const ink = role === "kid" ? childInk : parentInk;
    if (ink.length >= 80) return;
    e.preventDefault();
    pointer = e.pointerId;
    el.setPointerCapture(pointer);
    currentStroke = [coord(e)];
    ink.push(currentStroke);
    paintPapers();
    $("undo").disabled = !parentInk.length;
  };
  el.onpointermove = (e) => {
    if (
      e.pointerId === pointer &&
      currentStroke &&
      currentStroke.length < 1500
    ) {
      currentStroke.push(coord(e));
      paintPapers();
    }
  };
  el.onpointerup =
    el.onlostpointercapture =
    el.onpointercancel =
      () => {
        pointer = null;
        currentStroke = null;
        saveDraft();
      };
}
function saveDraft() {
  if (!pendingId) return;
  write(
    prefix + "draft",
    JSON.stringify({
      id: pendingId,
      verdict,
      feedback: $("feedback").value,
      ink: parentInk,
      editing,
    }),
  );
}
function apply(at, expected = pendingId) {
  if (at.id !== expected || expected !== pendingId || at.version < revision)
    return;
  revision = at.version;
  stopped = at.elapsed;
  goal = at.target;
  attempt = at;
  if (at.status === "father") {
    editing = false;
    pen = false;
    sending = false;
    write(prefix + "draft", null);
  }
  render();
}
function renderReply(el, result, by) {
  el.replaceChildren();
  el.hidden = !result;
  if (!result) return;
  const title = document.createElement("strong");
  title.textContent = by + " · " + (labels[result.verdict] || "확인 완료");
  el.append(title);
  if (result.feedback) {
    const p = document.createElement("p");
    p.textContent = result.feedback;
    el.append(p);
  }
}
function render() {
  const state = attempt?.status || "";
  const active = ["checking", "review", "preview", "error"].includes(state);
  const compose = active || (state === "ai" && editing);
  $("submit").disabled = !ready || !!pendingId;
  $("submit").textContent = pendingId ? "제출됨" : "제출";
  $("target").disabled = !!pendingId;
  document
    .querySelectorAll("[data-time]")
    .forEach((b) => (b.disabled = !!pendingId));
  $("kidState").textContent = !pendingId
    ? "풀이 중"
    : state === "father" || state === "ai"
      ? "답변 도착"
      : "풀이 확인 중";
  $("dadState").textContent =
    {
      checking: "풀이 확인 중 · Codex",
      review: "풀이 확인 중 · 아빠",
      father: "아빠 답변 전송됨",
      ai: "Codex 채점 완료",
      preview: "풀이 확인 중 · 예시",
      error: "Codex 연결 확인",
    }[state] || "같은 쪽 보기";
  $("intervene").hidden = !compose;
  $("reopen").hidden = state !== "ai" || editing;
  $("send").disabled = !verdict || sending || !compose;
  $("pen").setAttribute("aria-pressed", String(pen));
  document.querySelector(".teacher").classList.toggle("inking", pen);
  $("undo").disabled = !parentInk.length || sending;
  document
    .querySelectorAll("[data-verdict]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.verdict === verdict)),
    );
  const result = state === "ai" || state === "father" ? attempt.result : null;
  renderReply($("kidReply"), result, state === "father" ? "아빠" : "Codex");
  renderReply(
    $("dadReply"),
    result,
    state === "father" ? "보낸 답변" : "Codex",
  );
  if (attempt?.thread && /^[\da-f-]{36}$/i.test(attempt.thread)) {
    $("dadReply").hidden = false;
    const a = document.createElement("a");
    a.href = "codex://threads/" + attempt.thread;
    a.textContent = "Mac에서 채점 대화 열기";
    $("dadReply").append(a);
  }
  if (attempt?.draft?.reading && state !== "checking") {
    const p = document.createElement("p");
    p.textContent = "인식한 풀이 · " + attempt.draft.reading;
    $("dadReply").hidden = false;
    $("dadReply").append(p);
  }
  paintPapers();
  paintTime();
}
async function watch(id, gen) {
  while (
    gen === generation &&
    pendingId === id &&
    ["review", "checking"].includes(attempt?.status)
  ) {
    try {
      const at = await api("/attempts/" + id + "?after=" + revision);
      if (gen !== generation) return;
      apply(at, id);
    } catch {
      if (gen !== generation) return;
      note(
        "연결을 다시 확인하고 있어요. 작성 중인 첨삭은 이 화면에 보관됩니다.",
      );
      await sleep(2500);
    }
  }
}
async function submit() {
  if (!ready || pendingId || waiting) return;
  waiting = true;
  const gen = generation;
  const elapsedAtSubmit = elapsed();
  stopped = elapsedAtSubmit;
  submittedAt = Date.now();
  const id = crypto.randomUUID();
  pendingId = id;
  revision = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 910;
  canvas.height = 348;
  draw(canvas, "kid", true);
  render();
  note("풀이를 보내는 중입니다.");
  try {
    const at = token
      ? await api("/attempts/" + id, "POST", {
          image: canvas.toDataURL("image/png").split(",")[1],
          room: room || undefined,
          elapsed: stopped,
          target: goal,
        })
      : { id, status: "preview", version: 1, elapsed: stopped, target: goal };
    if (gen !== generation) return;
    write(prefix + "id", token ? id : null);
    apply(at, id);
    note(
      token
        ? "아빠가 직접 채점하거나 Codex 결과를 기다릴 수 있습니다."
        : "화면 미리보기입니다. 실제 채점은 개인 리뷰 링크에서 실행됩니다.",
    );
    if (token) watch(id, gen);
  } catch (e) {
    if (gen !== generation) return;
    // The POST may already have arrived. Look it up before enabling another submit.
    if (token) {
      try {
        const at = await api("/attempts/" + id);
        write(prefix + "id", id);
        apply(at, id);
        watch(id, gen);
        return;
      } catch {}
    }
    pendingId = null;
    started = Date.now() - elapsedAtSubmit * 1000;
    stopped = null;
    note(e.message);
    render();
  } finally {
    waiting = false;
  }
}
let claiming = null;
function claim() {
  if (!pendingId || attempt?.status === "father") return Promise.resolve();
  if (editing) return claiming || Promise.resolve();
  editing = true;
  saveDraft();
  render();
  if (!token) return Promise.resolve();
  const id = pendingId;
  claiming = api("/attempts/" + id + "/claim", "POST", {})
    .then((at) => apply(at, id))
    .catch((e) => note(e.message))
    .finally(() => {
      claiming = null;
    });
  return claiming;
}
async function send() {
  if (!pendingId || !verdict || sending) return;
  const id = pendingId;
  const payload = {
    verdict,
    feedback: $("feedback").value.trim(),
    ink: parentInk,
  };
  sending = true;
  render();
  try {
    await claim();
    const at = token
      ? await api("/attempts/" + id + "/reply", "POST", payload)
      : {
          ...attempt,
          status: "father",
          version: revision + 1,
          result: payload,
        };
    apply(at, id);
    note("서아의 풀이에 아빠 판정과 첨삭을 보냈습니다.");
  } catch (e) {
    note(e.message);
  } finally {
    sending = false;
    render();
  }
}
function restart() {
  if (waiting || sending) return;
  generation++;
  pendingId = null;
  attempt = null;
  revision = 0;
  stopped = null;
  submittedAt = null;
  started = Date.now();
  editing = false;
  pen = false;
  verdict = "";
  claiming = null;
  parentInk = [];
  childInk = [];
  $("feedback").value = "";
  write(prefix + "id", null);
  write(prefix + "draft", null);
  note(token ? "저장된 실제 풀이를 열었습니다." : "공개 예시 문제입니다.");
  render();
}
let roomVersion = 0,
  roomEpoch = -1;
async function resumeAttempt(id) {
  const stamp = ++generation;
  const [at, saved] = await Promise.all([
    api("/attempts/" + id),
    api("/attempts/" + id + "/image", "GET", null, true).then(bitmap),
  ]);
  if (stamp !== generation) return;
  pendingId = id;
  revision = 0;
  sample = saved;
  childInk = [];
  parentInk = [];
  editing = false;
  verdict = "";
  pen = false;
  $("feedback").value = "";
  goal = at.target;
  $("target").value = String(goal);
  stopped = at.elapsed;
  submittedAt = at.created * 1000;
  let draft;
  try {
    draft = JSON.parse(read(prefix + "draft"));
  } catch {}
  if (draft?.id === id && at.status !== "father") {
    verdict = draft.verdict;
    parentInk = draft.ink || [];
    $("feedback").value = draft.feedback || "";
    editing = draft.editing;
  }
  write(prefix + "id", id);
  apply(at, id);
  if (["checking", "review"].includes(at.status)) watch(id, generation);
}
async function syncRoom(state) {
  if (state.version <= roomVersion) return;
  roomVersion = state.version;
  if (roomEpoch !== state.epoch && roomEpoch !== -1) {
    sample = originalSample;
    restart();
  }
  roomEpoch = state.epoch;
  if (state.active) {
    if (state.active !== pendingId) await resumeAttempt(state.active);
    else if (attempt && !waiting) {
      const before = attempt.status;
      const at = await api("/attempts/" + state.active);
      apply(at, state.active);
      if (
        !["review", "checking"].includes(before) &&
        ["checking", "review"].includes(at.status)
      )
        watch(state.active, generation);
    }
  } else if (!pendingId) {
    goal = state.target;
    $("target").value = String(goal);
    started = Date.now() - state.elapsed * 1000;
    paintTime();
  }
}
async function watchRoom() {
  while (true) {
    try {
      await syncRoom(await api("/rooms/" + room + "?after=" + roomVersion));
    } catch {
      await sleep(2500);
    }
  }
}
function changeClock() {
  if (room && token)
    api("/rooms/" + room, "POST", {
      kind: "clock",
      target: goal,
      elapsed: elapsed(),
    })
      .then(syncRoom)
      .catch((e) => note(e.message));
}
async function init() {
  render();
  if (token) {
    try {
      sample = await bitmap(await api("/sample", "GET", null, true));
      $("connection").textContent = "Codex 연결됨";
      originalSample = sample;
      if (room) {
        await syncRoom(await api("/rooms/" + room));
        watchRoom();
      } else if (read(prefix + "id")) await resumeAttempt(read(prefix + "id"));
      note("저장된 실제 풀이 · 예제 4-1");
      ready = true;
    } catch (e) {
      $("connection").textContent = "Mac 연결 확인";
      note(e.message + " · 페이지를 새로고침해 주세요.");
    }
  } else {
    ready = true;
    note(
      "공개 예시입니다. 실제 풀이와 Codex 채점은 개인 리뷰 링크에서 열립니다.",
    );
  }
  if (!pendingId && !(room && token)) started = Date.now();
  render();
}
let originalSample = null;
$("restart").onclick = async () => {
  if (waiting || sending) return;
  if (room && token) {
    try {
      await syncRoom(await api("/rooms/" + room, "POST", { kind: "restart" }));
    } catch (e) {
      note(e.message);
    }
  } else {
    if (originalSample) sample = originalSample;
    restart();
  }
};
$("target").onchange = (e) => {
  goal = Number(e.target.value);
  paintTime();
  changeClock();
};
$("submit").onclick = submit;
$("send").onclick = send;
$("reopen").onclick = claim;
$("feedback").oninput = () => {
  claim();
  saveDraft();
};
$("pen").onclick = () => {
  claim();
  pen = !pen;
  render();
  if (pen) {
    note("아빠 풀이 위에 그려 주세요. 확대해서 표시할 수도 있습니다.");
  }
};
$("undo").onclick = () => {
  if (!sending) {
    parentInk.pop();
    saveDraft();
    render();
  }
};
document.querySelectorAll("[data-verdict]").forEach(
  (b) =>
    (b.onclick = () => {
      claim();
      verdict = b.dataset.verdict;
      saveDraft();
      render();
    }),
);
document.querySelectorAll("[data-time]").forEach(
  (b) =>
    (b.onclick = () => {
      if (pendingId) return;
      const times = {
        minute: 60,
        fade: (goal * 2) / 3,
        middle: (goal * 2) / 3 + 5,
        hidden: (goal * 2) / 3 + 10,
      };
      started = Date.now() - times[b.dataset.time] * 1000;
      paintTime();
      changeClock();
    }),
);
document.querySelectorAll("[data-paper]").forEach(bindCanvas);
document.querySelectorAll("[data-expand]").forEach(
  (b) =>
    (b.onclick = () => {
      const role = b.dataset.expand;
      $("zoomTitle").textContent =
        role === "dad" ? "아빠 · 풀이 확대" : "서아 · 풀이 확대";
      const canvas = document.createElement("canvas");
      canvas.width = 910;
      canvas.height = 348;
      canvas.dataset.paper = role;
      canvas.className = role === "kid" || pen ? "draw" : "";
      $("zoomPaper").replaceChildren(canvas);
      $("zoomHelp").textContent =
        role === "dad"
          ? pen
            ? "여기에 첨삭하고 닫은 뒤 답변을 보내세요."
            : "아빠 채점에서 첨삭 펜을 켜면 표시할 수 있습니다."
          : "제출 전에는 이 위에 필기할 수 있습니다.";
      bindCanvas(canvas);
      draw(canvas, role);
      $("zoom").showModal();
    }),
);
$("closeZoom").onclick = () => $("zoom").close();
$("zoom").onclose = () => {
  $("zoomPaper").replaceChildren();
};
if (!moveToPrivateScreen) init();
