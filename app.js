/* =============================================================================
   app.js — بوابة تثبيت «نظام الورديات» (PWA Install Gatekeeper)
   JavaScript قياسي فقط: لا مكتبات، لا وحدات، لا build. يعمل قبل أن يشتغل أي
   كود آخر في الصفحة، وقراره محصور في خاصية واحدة على <html>.

   1) حالة التطبيق:
        · standalone (display-mode: standalone أو navigator.standalone على iOS)
            ⇒ إظهار #app-content وإخفاء #install-screen
        · وضع المتصفح
            ⇒ إخفاء #app-content (مع inert) وعرض #install-screen
   2) أندرويد / سطح المكتب (كروم، إيدج، بريف):
        يلتقط beforeinstallprompt (ويمنع بانر المتصفح) ويربطه بزر #install-button.
   3) iOS Safari (آيفون / آيباد):
        لا يوجد beforeinstallprompt ⇒ إخفاء الزر وعرض ثلاث خطوات:
        «مشاركة» ← «إضافة إلى الشاشة الرئيسية» ← «إضافة» ثم الفتح من الأيقونة.

   مبادئ:
   · أي استثناء ⇒ التطبيق يعمل (البوابة وسيلة لتوجيه المستخدم، لا سدّ للنظام).
   · لا مطالبة ولا نافذة أثناء الاستخدام: يُعاد التقييم عند الدخول فقط
     (فتح الصفحة، الرجوع للتبويب، تغيّر display-mode، نجاح التثبيت).
   · مخارج للمُشغّل: ?installgate=off  (تجاهل)  ·  ?installgate=force (اختبار)
   ============================================================================= */

(function (global) {
  'use strict'

  var doc = global.document

  var CONFIG = {
    /* true ⇒ يظهر زر «الدخول بدون تثبيت» لمن يرفض التثبيت (للمدارس التي تشارك رابطاً على الحاسب) */
    allowSkip: true,
    /* يُخزَّن في sessionStorage بعد الاختيار حتى لا نعاود المنع في نفس الجلسة */
    skipKey: 'wrdiat.install-gate-skip',
    queryParam: 'installgate',
    /* كل وضع عرض يعني «التطبيق مفتوح من أيقونته» */
    standaloneDisplayModes: ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'],
    /* مضيفات تُعامل كوضع تطوير (يظهر فيها مخرج التجاوز تلقائياً) */
    devHosts: []
  }

  var IDS = {
    gate: 'install-screen',
    app: 'app-content',
    button: 'install-button',
    buttonLabel: 'install-button-label',
    ready: 'install-ready',
    ios: 'install-ios',
    manual: 'install-manual',
    done: 'install-done',
    status: 'install-status',
    reload: 'install-reload',
    skip: 'install-skip'
  }

  var deferredPrompt = null
  var installed = false
  var bound = false

  /* وصل السكربت ⇒ لا حاجة للحارس الزمني في index.html */
  global.__igReady = true
  if (global.__igWatchdog) {
    global.clearTimeout(global.__igWatchdog)
    global.__igWatchdog = null
  }

  /* ================================ أدوات ================================ */

  function el(id) {
    return doc.getElementById(id)
  }

  function mediaMatches(query) {
    try {
      return typeof global.matchMedia === 'function' && global.matchMedia(query).matches === true
    } catch (e) {
      return false
    }
  }

  function store(key, value) {
    try {
      if (value === null) global.sessionStorage.removeItem(key)
      else global.sessionStorage.setItem(key, value)
    } catch (e) {
      /* تصفح خاص/مقيّد — نتجاهل بهدوء */
    }
  }

  function read(key) {
    try {
      return global.sessionStorage.getItem(key)
    } catch (e) {
      return null
    }
  }

  function queryFlag() {
    try {
      return new URLSearchParams(global.location.search).get(CONFIG.queryParam)
    } catch (e) {
      return null
    }
  }

  function onMediaChange(query, handler) {
    try {
      var mql = global.matchMedia(query)
      if (!mql) return
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler)
      else if (typeof mql.addListener === 'function') mql.addListener(handler)
    } catch (e) {
      /* متصفح قديم بلا matchMedia — نُصنّف عند كل دخول بدل الاعتماد عليه */
    }
  }

  /* ============================ 1) كشف الحالة ============================ */

  function isStandalone() {
    if (global.navigator && global.navigator.standalone === true) return true /* iOS */
    var modes = CONFIG.standaloneDisplayModes
    for (var i = 0; i < modes.length; i += 1) {
      if (mediaMatches('(display-mode: ' + modes[i] + ')')) return true
    }
    return false
  }

  /* iOS — بما فيها iPadOS 13+ التي تُبلّغ عن نفسها كـ MacIntel */
  function isIOS() {
    var nav = global.navigator || {}
    var platform = nav.platform || ''
    var maxTouch = nav.maxTouchPoints || 0
    if (/iPad|iPhone|iPod/.test(platform)) return true
    if (platform === 'MacIntel' && maxTouch > 1) return true
    return /iPad|iPhone|iPod/.test(nav.userAgent || '')
  }

  /* سفاري على iOS: لا تدعم beforeinstallprompt إطلاقاً (كل متصفحات iOS WebKit) */
  function isIOSNativeBrowser() {
    var ua = (global.navigator && global.navigator.userAgent) || ''
    var otherEngine = /CriOS|FxiOS|EdgiOS|OPiOS|Android|Chrome\//.test(ua)
    var safariToken = /Version\/[\d._]+/.test(ua) && /Safari/.test(ua)
    return isIOS() && safariToken && !otherEngine
  }

  function supportsBeforeInstallPrompt() {
    return typeof global.BeforeInstallPromptEvent === 'function'
  }

  function isDevHost() {
    var loc = global.location || {}
    var host = loc.host || loc.hostname || ''
    var list = CONFIG.devHosts || []
    for (var i = 0; i < list.length; i += 1) {
      if (host === list[i]) return true
    }
    return host === '' || /^localhost(:\d+)?$/.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host) ||
      /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(host)
  }

  /* 'gate' = وضع المتصفح (البوابة ظاهرة) · 'app' = التطبيق المثبّت أو تجاوز */
  function isOffline() {
    return Boolean(global.navigator) && global.navigator.onLine === false
  }

  function decide() {
    var flag = queryFlag()
    if (flag === 'off' || flag === 'skip') return { mode: 'app', reason: 'param' }
    if (flag === 'force') return { mode: 'gate', reason: 'force' }
    // انقطاع الشبكة ⇒ التطبيق يعمل بلا بوابة (لا نطالب بالإنترنت إلا عند الضرورة)
    if (isOffline()) return { mode: 'app', reason: 'offline' }
    if (isStandalone()) return { mode: 'app', reason: 'standalone' }
    if (read(CONFIG.skipKey) === '1') return { mode: 'app', reason: 'skipped' }
    return { mode: 'gate', reason: 'browser' }
  }

  /* ======================= 2) + 3) رسم شاشة التثبيت ======================= */

  function setNode(node, visible) {
    if (!node) return
    if (visible) node.removeAttribute('hidden')
    else node.setAttribute('hidden', '')
  }

  function say(message) {
    var status = el(IDS.status)
    if (!status) return
    status.textContent = message || ''
    setNode(status, Boolean(message))
  }

  function apply() {
    var root = doc.documentElement
    var decision = decide()
    var gating = decision.mode === 'gate'

    root.setAttribute('data-install-gate', gating ? 'gate' : 'app')

    var app = el(IDS.app)
    if (gating && app) {
      app.setAttribute('aria-hidden', 'true')
      app.setAttribute('inert', '')
      try { app.inert = true } catch (e) { /* متصفح بلا inert — CSS يكفي */ }
    } else if (app) {
      app.removeAttribute('aria-hidden')
      app.removeAttribute('inert')
      try { app.inert = false } catch (e) {}
    }

    if (gating) renderPanel()
    return decision
  }

  /* لوحة كروم (زر التثبيت) أم لوحة iOS (خطوات) أم دليل يدوي لبقية المتصفحات */
  function renderPanel() {
    var button = el(IDS.button)
    var label = el(IDS.buttonLabel)
    var ios = el(IDS.ios)
    var manual = el(IDS.manual)
    var done = el(IDS.done)
    var ready = el(IDS.ready)
    var reload = el(IDS.reload)

    var canInstall = Boolean(deferredPrompt) || supportsBeforeInstallPrompt()
    var showIosSteps = isIOS() && !canInstall
    var nativeIos = isIOSNativeBrowser()

    setNode(button, Boolean(deferredPrompt))
    setNode(ready, showIosSteps)
    setNode(ios, showIosSteps)
    setNode(manual, !canInstall && !showIosSteps)
    setNode(done, installed)
    setNode(reload, installed || (showIosSteps && nativeIos))
    setNode(el(IDS.skip), CONFIG.allowSkip || isDevHost())

    if (label) label.textContent = installed ? 'متابعة التثبيت' : 'تثبيت نظام الورديات'

    if (installed) {
      say('تم التثبيت — افتح «ورديات» من أيقونته في الشاشة الرئيسية.')
      return
    }
    if (deferredPrompt) {
      say('تثبيت بلمسة واحدة: يعمل بلا إنترنت ويُبقي جدولك على جهازك.')
      return
    }
    if (showIosSteps) {
      say(nativeIos ? 'على سفاري الخطوات بالأسفل تعمل مباشرة.' : 'من متصفح النظام (سفاري) تُضاف الأيقونة إلى الشاشة الرئيسية.')
      return
    }
    if (isDevHost()) {
      say('وضع تطوير: التثبيت يحتاج نشر الصفحة على HTTPS مع manifest وService Worker.')
      return
    }
    say('هذا المتصفح لا يعرض زر التثبيت — استخدم الطريقة اليدوية بالأسفل.')
  }

  /* ==================== 2) ربط beforeinstallprompt بالزر ==================== */

  function captureBeforeInstallPrompt(event) {
    /* نمنع بانر المتصفح ونمسك الحدث لزرّنا */
    if (typeof event.preventDefault === 'function') event.preventDefault()
    deferredPrompt = event
    renderPanel()
  }

  function installNow() {
    if (!deferredPrompt || typeof deferredPrompt.prompt !== 'function') return
    var button = el(IDS.button)
    if (button) button.setAttribute('disabled', '')
    say('جارٍ عرض نافذة التثبيت…')

    try {
      var result = deferredPrompt.prompt()
      if (!result || typeof result.then !== 'function') {
        deferredPrompt = null
        if (button) button.removeAttribute('disabled')
        renderPanel()
        return
      }
      result
        .then(function (choice) {
          var outcome = (choice && choice.outcome) || 'unknown'
          deferredPrompt = null
          if (outcome === 'accepted') {
            installed = true
            say('قُبل التثبيت — سيُضاف اختصار «ورديات» إلى شاشتك الرئيسية.')
          } else {
            say('أُلغي طلب التثبيت — يمكنك المحاولة مرة أخرى في أي وقت.')
          }
        })
        .catch(function () {
          say('تعذّر إكمال التثبيت — استخدم الطريقة اليدوية بالأسفل.')
        })
        .then(function () {
          if (button) button.removeAttribute('disabled')
          renderPanel()
        })
    } catch (e) {
      if (button) button.removeAttribute('disabled')
      say('تعذّر إكمال التثبيت — استخدم الطريقة اليدوية بالأسفل.')
    }
  }

  function skipGate() {
    store(CONFIG.skipKey, '1')
    apply()
  }

  /* معالج واحد مفوّض: يعمل حتى لو أُعيد بناء عناصر البوابة */
  function handleClick(event) {
    var target = event && event.target
    if (!target || typeof target.closest !== 'function') return
    var action = target.closest('[data-action]')
    if (!action || !action.getAttribute) return
    var name = action.getAttribute('data-action')
    if (name === 'install') installNow()
    else if (name === 'skip') skipGate()
    else if (name === 'reload') global.location.reload()
  }

  function bind() {
    if (bound) return
    bound = true

    global.addEventListener('beforeinstallprompt', captureBeforeInstallPrompt)
    global.addEventListener('appinstalled', function () {
      installed = true
      deferredPrompt = null
      apply()
    })

    doc.addEventListener('click', handleClick)

    // انقطعت الشبكة ونحن نعرض البوابة ⇒ نكشف التطبيق فورًا
    global.addEventListener('offline', function () {
      apply()
    })

    /* إعادة التصنيف عند «الدخول» فقط — لا تذكير أثناء الاستخدام */
    var recheck = function () { apply() }
    doc.addEventListener('visibilitychange', recheck)
    global.addEventListener('pageshow', recheck)
    global.addEventListener('focus', recheck)

    onMediaChange('(display-mode: standalone)', recheck)
    onMediaChange('(display-mode: minimal-ui)', recheck)
    onMediaChange('(display-mode: fullscreen)', recheck)
  }

  /* ================================ إقلاع ================================ */

  function boot() {
    apply()
    bind()
  }

  /*
   * أقلع فورًا: مستمِعاتنا على document (النقر المفوَّض والأحداث) لا تحتاج DOM مكتملًا،
   * والتحكّم البصري تقوده خاصية <html> التي ضبطها مصنّف <head>. وإن كان التحليل لم
   * يكتمل بعد نُعيد الإقلاع على DOMContentLoaded لنلحق العناصر (inert/aria-hidden).
   * هكذا لا يوجد سباق بين ترتيب تحمّل app.js وحدث DOMContentLoaded.
   */
  boot()
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true })

  /* واجهة للتحكّم والاختبار من التطبيق نفسه */
  global.WrdiatInstallGate = {
    config: CONFIG,
    decide: decide,
    apply: apply,
    refresh: apply,
    install: installNow,
    skip: skipGate,
    isStandalone: isStandalone,
    isIOS: isIOS,
    isIOSNativeBrowser: isIOSNativeBrowser,
    isDevHost: isDevHost,
    isOffline: isOffline,
    supportsBeforeInstallPrompt: supportsBeforeInstallPrompt,
    hasPrompt: function () { return Boolean(deferredPrompt) },
    isInstalled: function () { return installed }
  }
})(typeof window !== 'undefined' ? window : this)
