<?php
// Основная библиотека модуля: установка, обновление, удаление, поддержка функций Moodle.

/**
 * Список стендов виртуальной лаборатории.
 *
 * @return array
 */
function mod_energy_bench_list(): array {
    return [
        'circuits'   => get_string('bench_circuits', 'mod_energy'),
        'renew'      => get_string('bench_renew', 'mod_energy'),
        'storage'    => get_string('bench_storage', 'mod_energy'),
        'efficiency' => get_string('bench_efficiency', 'mod_energy'),
        'hydrogen'   => get_string('bench_hydrogen', 'mod_energy'),
        'grid'       => get_string('bench_grid', 'mod_energy'),
        'mech'       => get_string('bench_mech', 'mod_energy'),
        'thermal'    => get_string('bench_thermal', 'mod_energy'),
    ];
}

/**
 * Какие стенды разрешены в экземпляре (поле benchess хранится списком через запятую).
 *
 * @param stdClass $instance
 * @return array
 */
function mod_energy_enabled_benches(stdClass $instance): array {
    $all = array_keys(mod_energy_bench_list());
    $raw = trim((string)($instance->benchess ?? ''));
    if ($raw === '') {
        return $all;
    }
    $list = array_values(array_intersect($all, array_map('trim', explode(',', $raw))));
    return $list === [] ? $all : $list;
}

/**
 * Добавление экземпляра активности в курс.
 *
 * @param stdClass $data
 * @param mod_energy_mod_form|null $mform
 * @return int id нового экземпляра
 */
function mod_energy_add_instance(stdClass $data, $mform = null): int {
    global $DB;

    $data->timecreated = time();
    $data->timemodified = time();
    $data->benchess = implode(',', $data->benchess ?? []);

    return (int)$DB->insert_record('energy', $data);
}

/**
 * Обновление экземпляра.
 *
 * @param stdClass $data
 * @param mod_energy_mod_form|null $mform
 * @return bool
 */
function mod_energy_update_instance(stdClass $data, $mform = null): bool {
    global $DB;

    $data->id = $data->instance;
    $data->timemodified = time();
    $data->benchess = implode(',', $data->benchess ?? []);

    return $DB->update_record('energy', $data);
}

/**
 * Удаление экземпляра вместе с оценками и прогрессом.
 *
 * @param int $id
 * @return bool
 */
function mod_energy_delete_instance($id): bool {
    global $DB;

    if (!$energy = $DB->get_record('energy', ['id' => $id])) {
        return false;
    }
    $DB->delete_records('energy_progress', ['energyid' => $energy->id]);
    $DB->delete_records('energy', ['id' => $energy->id]);

    return true;
}

/**
 * Функции, которые поддерживает модуль (иначе Moodle не покажет оценки и «завершение»).
 *
 * @param string $feature
 * @return mixed
 */
function mod_energy_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return true;
        case FEATURE_GRADE_OUTCOMES:
            return false;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS:
            return true;
        case FEATURE_GROUPS:
            return false;
        case FEATURE_MOD_PURPOSE:
            return MOD_PURPOSE_ASSESSMENT;
        default:
            return null;
    }
}

/**
 * Обновление оценки в журнале по прогрессу студента.
 *
 * @param stdClass $energy экземпляр модуля
 * @param int $userid
 * @param float $fraction 0..1
 * @return void
 */
function mod_energy_update_grade(stdClass $energy, int $userid, float $fraction): void {
    $cm = get_coursemodule_from_instance('energy', $energy->id);
    if (!$cm) {
        return;
    }
    $grade = mod_energy_grade_for($fraction, (float)$energy->grade);
    $grades = [(object)[
        'userid'   => $userid,
        'rawgrade' => $grade,
    ]];
    energy_grade_item_update($energy, $grades);
}

/**
 * Переводит долю выполнения в балл по максимальной оценке модуля.
 *
 * @param float $fraction
 * @param float $max
 * @return float
 */
function mod_energy_grade_for(float $fraction, float $max): float {
    $fraction = max(0.0, min(1.0, $fraction));
    return round($max * $fraction, 2);
}

/**
 * Элемент журнала оценок.
 *
 * @param stdClass $energy
 * @param array|null $grades
 * @return int
 */
function energy_grade_item_update(stdClass $energy, $grades = null): int {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    $item = [
        'itemname'  => clean_param($energy->name, PARAM_NOTAGS),
        'idnumber'  => 'mod_energy_' . $energy->id,
        'gradetype' => GRADE_TYPE_VALUE,
        'grademax'  => (float)$energy->grade,
        'grademin'  => 0,
    ];
    if ($grades === null) {
        return grade_update('mod/energy', $energy->course, 'mod', 'energy', $energy->id, 0, null, $item);
    }

    return grade_update('mod/energy', $energy->course, 'mod', 'energy', $energy->id, 0, $grades, $item);
}

/**
 * Удаление оценок при удалении экземпляра.
 *
 * @param int $courseid
 * @param int $instanceid
 * @return bool
 */
function mod_energy_grade_item_delete($courseid, $instanceid): bool {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    return grade_update('mod/energy', $courseid, 'mod', 'energy', $instanceid, 0, null,
        ['deleted' => 1]);
}

/**
 * Можно ли студенту открыть активность сейчас (учёт дат доступности Moodle).
 *
 * @param stdClass $energy
 * @return bool
 */
function mod_energy_is_open(stdClass $energy): bool {
    $now = time();
    $from = (int)($energy->timeopen ?? 0);
    $to = (int)($energy->timeclose ?? 0);
    if ($from && $now < $from) {
        return false;
    }
    if ($to && $now > $to) {
        return false;
    }
    return true;
}

/**
 * Сколько заданий доступно в экземпляре (по 8 на каждый включённый стенд).
 *
 * @param stdClass|null $energy
 * @return int
 */
function mod_energy_total_tasks(?stdClass $energy = null): int {
    if ($energy === null) {
        return 64;
    }
    return 8 * count(mod_energy_enabled_benches($energy));
}

/**
 * Сколько заданий выполнено всего (по всем стендам).
 *
 * @param array $solved
 * @return int
 */
function mod_energy_count_solved(array $solved): int {
    $n = 0;
    foreach ($solved as $tasks) {
        $n += count((array)$tasks);
    }
    return $n;
}

/**
 * Сводка прогресса студента по экземпляру.
 *
 * @param stdClass $energy
 * @param int $userid
 * @return stdClass
 */
function mod_energy_get_progress(stdClass $energy, int $userid): stdClass {
    global $DB;

    $row = $DB->get_record('energy_progress', ['energyid' => $energy->id, 'userid' => $userid]);
    $out = (object)[
        'solved'  => [],
        'stars'   => [],
        'best'    => 0,
        'total'   => mod_energy_total_tasks($energy),
        'percent' => 0,
        'time'    => 0,
        'istracked' => $row !== false,
    ];
    if ($row) {
        $solved = json_decode((string)$row->solved, true);
        $stars = json_decode((string)$row->stars, true);
        $out->solved = is_array($solved) ? $solved : [];
        $out->stars = is_array($stars) ? $stars : [];
        $out->best = (float)$row->best;
        $out->time = (int)$row->timemodified;
        $out->percent = (int)round(100 * max(0.0, min(1.0, $row->best)));
    }
    return $out;
}

/**
 * Возвращает курс, элемент курса и экземпляр плагина по cmid, проверяя права.
 *
 * @param int $cmid
 * @return array [course, cm, instance]
 */
function mod_energy_get_instance(int $cmid): array {
    global $DB;

    $cm = get_coursemodule_from_id('energy', $cmid, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $energy = $DB->get_record('energy', ['id' => $cm->instance], '*', MUST_EXIST);

    require_login($course, false, $cm);

    return [$course, $cm, $energy];
}

/**
 * Сводная таблица прогресса для преподавателя.
 *
 * @param stdClass $energy
 * @param context_module $context
 * @return array строки отчёта
 */
function mod_energy_report_rows(stdClass $energy, $context): array {
    global $DB;

    $rows = [];
    $records = $DB->get_records('energy_progress', ['energyid' => $energy->id], 'timemodified DESC');
    foreach ($records as $rec) {
        $user = $DB->get_record('user', ['id' => $rec->userid], 'id,firstname,lastname,deleted');
        if (!$user) {
            continue;
        }
        $solved = json_decode((string)$rec->solved, true) ?: [];
        $count = 0;
        foreach ($solved as $tasks) {
            $count += count((array)$tasks);
        }
        $rows[] = (object)[
            'userid' => $user->id,
            'fullname' => fullname($user),
            'solved' => $count,
            'stars' => (int)json_decode((string)$rec->stars, true),
            'percent' => (int)round(100 * (float)$rec->best),
            'time' => $rec->timemodified,
        ];
    }

    return $rows;
}
