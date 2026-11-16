<?php
// Самопроверка плагина без установки Moodle: структура, синтаксис, XML, ссылки в коде.
$root = __DIR__;
$errors = [];
$ok = [];

// 1) обязательные файлы
$required = [
    'version.php', 'lib.php', 'mod_form.php', 'view.php', 'index.php', 'report.php', 'settings.php',
    'styles.css', 'db/install.xml', 'db/access.php', 'db/services.php',
    'lang/en/energy.php', 'lang/ru/energy.php',
    'classes/privacy/provider.php', 'classes/event/course_module_viewed.php',
    'classes/external/save_progress.php',
    'amd/src/bridge.js', 'amd/build/bridge.min.js', 'standalone/lab.html',
    'pix/icon.svg', 'pix/icon.png',
    'backup/moodle2/backup_energy_activity_task.class.php',
    'backup/moodle2/backup_energy_stepslib.php',
    'backup/moodle2/restore_energy_activity_task.class.php',
    'backup/moodle2/restore_energy_stepslib.php',
];
foreach ($required as $f) {
    if (!is_file($root . '/' . $f)) {
        $errors[] = "нет файла $f";
    }
}
$ok[] = 'обязательные файлы: ' . count($required);

// 2) синтаксис PHP
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
    if ($file->getExtension() !== 'php') {
        continue;
    }
    $out = [];
    exec('php -l ' . escapeshellarg($file->getPathname()) . ' 2>&1', $out, $code);
    if ($code !== 0) {
        $errors[] = 'синтаксис: ' . str_replace($root . '/', '', $file->getPathname());
    }
}
$ok[] = 'php -l по всем файлам';

// 3) XML
libxml_use_internal_errors(true);
if (!simplexml_load_file($root . '/db/install.xml')) {
    $errors[] = 'db/install.xml не разбирается';
} else {
    $ok[] = 'db/install.xml валиден';
}

// 4) компонент и версия
$version = file_get_contents($root . '/version.php');
foreach (['mod_energy', '$plugin->version', '$plugin->requires', '$plugin->component'] as $needle) {
    if (strpos($version, $needle) === false) {
        $errors[] = "version.php без $needle";
    }
}
preg_match("/\\\$plugin->component\s*=\s*'([^']+)'/", $version, $m);
if (($m[1] ?? '') !== 'mod_energy') {
    $errors[] = 'component должен быть mod_energy';
}
$ok[] = 'version.php корректен';

// 5) таблицы и поля из install.xml совпадают с кодом
$xml = simplexml_load_file($root . '/db/install.xml');
$tables = [];
foreach ($xml->TABLES->TABLE as $t) {
    $fields = [];
    foreach ($t->FIELDS->FIELD as $f) {
        $fields[] = (string)$f['NAME'];
    }
    $tables[(string)$t['NAME']] = $fields;
}
foreach (['energy', 'energy_progress'] as $needle) {
    if (!isset($tables[$needle])) {
        $errors[] = "в install.xml нет таблицы $needle";
    }
}
foreach (['solved', 'stars', 'best', 'energyid', 'userid'] as $field) {
    if (!in_array($field, $tables['energy_progress'] ?? [], true)) {
        $errors[] = "в energy_progress нет поля $field";
    }
}
$ok[] = 'таблицы: ' . implode(', ', array_keys($tables));

// 6) языковые ключи ru/en совпадают
preg_match_all("/\\\$string\\['([^']+)'\\]/u", file_get_contents($root . '/lang/ru/energy.php'), $mru);
preg_match_all("/\\\$string\\['([^']+)'\\]/u", file_get_contents($root . '/lang/en/energy.php'), $men);
$diff = array_merge(array_diff(array_unique($mru[1]), array_unique($men[1])),
    array_diff(array_unique($men[1]), array_unique($mru[1])));
if ($diff) {
    $errors[] = 'языковые ключи расходятся: ' . implode(', ', $diff);
} else {
    $ok[] = 'языковые ключи: ' . count(array_unique($mru[1])) . ' (ru = en)';
}

// 7) сборка стенда на месте и содержит все девять стендов
$lab = file_get_contents($root . '/standalone/lab.html');
foreach (['data-bench-id="circuits"', 'data-bench-id="renew"', 'data-bench-id="storage"', 'data-bench-id="efficiency"',
    'data-bench-id="hydrogen"', 'data-bench-id="grid"', 'data-bench-id="mech"', 'data-bench-id="thermal"',
    'data-bench-id="optics"'] as $needle) {
    if (strpos($lab, $needle) === false) {
        $errors[] = "в standalone/lab.html нет $needle";
    }
}
foreach (['window.__lab', 'window.__renew', 'window.__storage', 'window.__eff', 'window.__hydrogen', 'window.__grid',
    'window.__mech', 'window.__thermal', 'window.__optics'] as $needle) {
    if (strpos($lab, $needle) === false) {
        $errors[] = "в сборке нет хука $needle";
    }
}
if (strpos($lab, 'preserveAspectRatio="xMidYMid slice"') !== false) {
    $errors[] = 'в сборке остался обрезающий preserveAspectRatio slice';
}
$ok[] = 'standalone/lab.html: 9 стендов и 9 хуков прогресса, размер ' . round(filesize($root . '/standalone/lab.html') / 1024) . ' КБ';

// 8) AJAX-сервис объявлен и класс существует
$services = file_get_contents($root . '/db/services.php');
if (strpos($services, 'mod_energy_save_progress') === false) {
    $errors[] = 'в db/services.php нет функции mod_energy_save_progress';
}
$class = file_get_contents($root . '/classes/external/save_progress.php');
foreach (['execute_parameters', 'execute_returns', 'mod_energy_update_grade'] as $needle) {
    if (strpos($class, $needle) === false) {
        $errors[] = "save_progress.php без $needle";
    }
}
$ok[] = 'веб-сервис сохранения прогресса объявлен';

// 9) мост ссылается на правильный адрес стенда
$bridge = file_get_contents($root . '/amd/src/bridge.js');
if (strpos(file_get_contents($root . '/amd/build/bridge.min.js'), 'mod_energy_save_progress') === false) {
    $errors[] = 'amd/build/bridge.min.js устарел: соберите его из amd/src/bridge.js';
}
if (strpos($bridge, '/mod/energy/standalone/lab.html') === false) {
    $errors[] = 'bridge.js не указывает на standalone/lab.html';
}
if (strpos($bridge, 'mod_energy_save_progress') === false) {
    $errors[] = 'bridge.js не вызывает веб-сервис';
}
$ok[] = 'amd/src/bridge.js связывает стенд с Moodle';

echo "ПРОВЕРКИ ПЛАГИНА\n";
foreach ($ok as $line) {
    echo "  OK   $line\n";
}
if ($errors) {
    echo "\nОШИБКИ:\n";
    foreach ($errors as $e) {
        echo "  !    $e\n";
    }
    exit(1);
}
echo "\nПлагин собран без ошибок.\n";
