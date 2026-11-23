/* Word Detective · 호스트 연결 (INTERFACE.md 참고)
 * 보내기: ready → caseResult(사건마다) → exit
 * 받기:   init, requestExit
 */
window.WDBridge = (function () {
  'use strict';
  var SOURCE = 'word-detective';
  var PROTOCOL = 1;
  var params = new URLSearchParams(location.search);
  var hostOrigin = params.get('hostOrigin') || '*';
  var handlers = { init: null, requestExit: null };
  var pendingInit = null;
  var exited = false;

  function nativeChannel() {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) return 'rn';
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wordDetective) return 'ios';
    if (window.WordDetectiveHost && window.WordDetectiveHost.postMessage) return 'android';
    return null;
  }
  function channel() {
    return nativeChannel() || (window.parent !== window ? 'iframe' : 'standalone');
  }

  function send(type, payload) {
    var msg = { source: SOURCE, protocol: PROTOCOL, type: type, payload: payload || {} };
    var ch = channel();
    try {
      if (ch === 'rn') window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      else if (ch === 'ios') window.webkit.messageHandlers.wordDetective.postMessage(msg);
      else if (ch === 'android') window.WordDetectiveHost.postMessage(JSON.stringify(msg));
      else if (ch === 'iframe') window.parent.postMessage(msg, hostOrigin);
      else console.info('[word-detective → host]', type, payload);
    } catch (e) {
      console.warn('[word-detective] send failed', e);
    }
  }

  function receive(raw) {
    var msg = raw;
    if (typeof raw === 'string') { try { msg = JSON.parse(raw); } catch (e) { return; } }
    if (!msg || msg.target !== SOURCE) return;
    if (msg.type === 'init') {
      if (handlers.init) handlers.init(msg.payload || {}, 'host');
      else pendingInit = msg.payload || {};
    } else if (msg.type === 'requestExit') {
      if (handlers.requestExit) handlers.requestExit();
    }
  }

  window.addEventListener('message', function (e) {
    if (hostOrigin !== '*' && e.origin && e.origin !== hostOrigin) return;
    receive(e.data);
  });
  document.addEventListener('message', function (e) { receive(e.data); }); // React Native (Android)

  // 네이티브 호스트가 evaluateJavascript로 직접 부를 수 있는 입구
  window.WordDetective = {
    init: function (cfg) { receive({ target: SOURCE, type: 'init', payload: cfg }); },
    requestExit: function () { receive({ target: SOURCE, type: 'requestExit' }); }
  };

  function configFromQuery() {
    var sessions = window.WD_UNIT_SESSIONS;
    var requested = params.get('day');
    var id = Object.hasOwn(sessions, requested) ? requested : 'u5-d1';
    return { sessionId: id, cases: sessions[id] };
  }

  return {
    channel: channel,
    /* onInit(cb): cb(config, source) 한 번 호출. source = host | query | default */
    onInit: function (cb, availableCases, version) {
      handlers.init = function (cfg, src) { handlers.init = null; cb(cfg, src); };
      send('ready', { version: version, availableCases: availableCases });
      if (pendingInit) { var p = pendingInit; pendingInit = null; return handlers.init(p, 'host'); }
      var q = configFromQuery();
      if (q) return handlers.init(q, 'query');
      // 호스트가 없으면 바로, 호스트가 있는데 init이 안 오면 3초 뒤 기본값으로 시작
      var wait = channel() === 'standalone' ? 0 : 3000;
      setTimeout(function () { if (handlers.init) handlers.init({}, 'default'); }, wait);
    },
    onRequestExit: function (cb) { handlers.requestExit = cb; },
    caseResult: function (r) { if (!exited) send('caseResult', r); },
    exit: function (payload) {
      if (exited) return;
      exited = true;
      send('exit', payload);
    }
  };
})();
