/* ---- UI-хелперы: пишем в DOM только когда значение изменилось ---- */
(function () {
  var textCache = new WeakMap(), attrCache = new WeakMap(), htmlCache = new WeakMap();
  window.UI = {
    text: function (el, v) {
      if (!el) return;
      var s = String(v);
      if (textCache.get(el) === s) return;
      textCache.set(el, s);
      el.textContent = s;
    },
    html: function (el, v) {
      if (!el) return;
      if (htmlCache.get(el) === v) return;
      htmlCache.set(el, v);
      el.innerHTML = v;
    },
    /* очистка сбрасывает кэш: иначе UI.html(el, '') считается «уже применённым»,
       а добавленные через appendChild узлы остаются — список дублируется */
    clear: function (el) {
      if (!el) return;
      if (el.firstChild) el.textContent = '';
      htmlCache.delete(el);
    },
    attr: function (el, name, v) {
      if (!el) return;
      var m = attrCache.get(el) || (attrCache.set(el, {}), attrCache.get(el));
      if (m[name] === v) return;
      m[name] = v;
      el.setAttribute(name, v);
    },
    cls: function (el, name, on) {
      if (!el) return;
      var m = attrCache.get(el) || (attrCache.set(el, {}), attrCache.get(el));
      var key = 'cls:' + name;
      if (m[key] === on) return;
      m[key] = on;
      el.classList.toggle(name, on);
    }
  };
})();

