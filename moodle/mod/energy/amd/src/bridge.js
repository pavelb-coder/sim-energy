// Мост между виртуальной лабораторией и Moodle.
//
// 1. Загружает автономную сборку стенда (standalone/lab.js) в iframe без сервера.
// 2. Оставляет только те стенды, которые разрешил преподаватель.
// 3. Следит за заданиями: как только студент выполняет новое, отправляет прогресс
//    в Moodle через веб-сервис mod_energy_save_progress и обновляет оценку.

define(['core/ajax', 'core/notification'], function(Ajax, Notification) {

    let config = null;
    let frame = null;
    let connected = false;
    let lastSent = {};
    let pollTimer = null;

    /**
     * Ключи стендов в терминах сборки.
     *
     * @param {String} bench
     * @return {String}
     */
    function benchHook(bench) {
        return bench === 'circuits' ? '__lab' : '__' + bench;
    }

    /**
     * Собирает прогресс по всем стендам из state-хуков сборки.
     *
     * @return {Object} {renew: {"0": 3}, storage: {...}}
     */
    function collectSolved() {
        const win = frame ? frame.contentWindow : null;
        if (!win) {
            return {};
        }
        const out = {};
        config.benches.forEach(function(bench) {
            const hook = win[benchHook(bench)];
            if (!hook || typeof hook.solved !== 'function') {
                return;
            }
            let solved = {};
            try {
                solved = hook.solved() || {};
            } catch (e) {
                solved = {};
            }
            if (Object.keys(solved).length) {
                out[bench] = solved;
            }
        });
        return out;
    }

    /**
     * Сколько заданий выполнено и сколько звёзд.
     *
     * @param {Object} solved
     * @return {Object}
     */
    function summarize(solved) {
        let count = 0;
        let stars = 0;
        Object.keys(solved).forEach(function(bench) {
            const tasks = solved[bench] || {};
            Object.keys(tasks).forEach(function(k) {
                count += 1;
                stars += Number(tasks[k]) || 1;
            });
        });
        return {count: count, stars: stars};
    }

    /**
     * Обновляет полосу прогресса в интерфейсе Moodle.
     *
     * @param {Object} solved
     */
    function renderProgress(solved) {
        const sum = summarize(solved);
        const percent = Math.min(100, Math.round(100 * sum.count / Math.max(1, config.target)));
        const bar = document.getElementById('mod-energy-bar');
        const text = document.getElementById('mod-energy-progress');
        if (bar) {
            bar.style.width = percent + '%';
            bar.setAttribute('aria-valuenow', percent);
        }
        if (text) {
            text.textContent = text.dataset.template
                ? text.dataset.template.replace('{done}', sum.count)
                : text.textContent.replace(/\d+(?=\s+из)/, sum.count);
            text.dataset.done = sum.count;
        }
    }

    /**
     * Отправляет прогресс в Moodle, если он изменился.
     */
    function pushProgress() {
        if (!config.open) {
            return;
        }
        const solved = collectSolved();
        renderProgress(solved);

        Object.keys(solved).forEach(function(bench) {
            const payload = JSON.stringify(solved[bench]);
            if (lastSent[bench] === payload) {
                return;
            }
            lastSent[bench] = payload;
            Ajax.call([{
                methodname: 'mod_energy_save_progress',
                args: {cmid: config.cmid, bench: bench, solved: payload},
            }])[0].then(function(response) {
                Notification.addNotification({
                    message: response.message + ' (' + response.percent + ' %)',
                    type: 'success',
                });
                const bar = document.getElementById('mod-energy-bar');
                if (bar) {
                    bar.style.width = response.percent + '%';
                }
                return response;
            }).catch(function(error) {
                // если сеть/сервис отвалились — не спамим, попробуем в следующем цикле
                lastSent[bench] = null;
                return error;
            });
        });
    }

    /**
     * Прячет в меню стендов те, что запрещены настройками активности,
     * и открывает нужный стенд.
     */
    function restrictBenches() {
        const doc = frame.contentDocument;
        if (!doc) {
            return;
        }
        doc.querySelectorAll('.benchnav button[data-bench]').forEach(function(btn) {
            if (config.benches.indexOf(btn.dataset.bench) === -1) {
                btn.style.display = 'none';
            }
        });
        const target = doc.querySelector('.benchnav button[data-bench="' + config.startBench + '"]');
        if (target) {
            target.click();
        }
    }

    /**
     * Подключается к содержимому iframe после загрузки.
     */
    function onFrameLoad() {
        try {
            restrictBenches();
        } catch (e) {
            // кросс-доменный iframe (не должно случаться: файл отдаёт сам Moodle)
            return;
        }
        connected = true;
        // первичная синхронизация: то, что уже сделано ранее
        const solved = collectSolved();
        renderProgress(solved);
        Object.keys(solved).forEach(function(bench) {
            lastSent[bench] = JSON.stringify(solved[bench]);
        });
        pollTimer = setInterval(pushProgress, 1500);
    }

    return {
        /**
         * Точка входа, вызывается из view.php.
         *
         * @param {Object} cfg
         */
        init: function(cfg) {
            config = cfg;
            const root = document.getElementById('mod-energy-root');
            if (!root) {
                return;
            }
            frame = document.createElement('iframe');
            frame.className = 'mod-energy-frame';
            frame.title = 'Виртуальная лаборатория';
            frame.setAttribute('allow', 'fullscreen');
            // без sandbox: нужен доступ к contentWindow/contentDocument для чтения прогресса
            frame.src = M.cfg.wwwroot + '/mod/energy/standalone/lab.html';
            frame.addEventListener('load', onFrameLoad);
            root.appendChild(frame);

            window.addEventListener('beforeunload', function() {
                if (pollTimer) {
                    clearInterval(pollTimer);
                }
                pushProgress();
            });
        },
    };
});
