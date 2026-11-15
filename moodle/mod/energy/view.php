<?php
// Страница активности: отдаёт стенд, подключает мост «стенд ↔ Moodle».

require('../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT);

[$course, $cm, $energy] = mod_energy_get_instance($id);
$context = context_module::instance($cm->id);

require_capability('mod/energy:view', $context);

$PAGE->set_url('/mod/energy/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($energy->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');
$PAGE->add_body_class('mod-energy-view');

$enabled = mod_energy_enabled_benches($energy);
$open = mod_energy_is_open($energy);
$isstaff = has_capability('mod/energy:viewreports', $context);

// доступность по датам
if (!$open && !$isstaff) {
    echo $OUTPUT->header();
    echo $OUTPUT->heading(format_string($energy->name));
    if (!empty($energy->timeopen) && time() < $energy->timeopen) {
        echo $OUTPUT->notification(get_string('notopenyet', 'mod_energy', userdate($energy->timeopen)), 'info');
    } else {
        echo $OUTPUT->notification(get_string('closedsince', 'mod_energy', userdate($energy->timeclose)), 'info');
    }
    echo $OUTPUT->footer();
    exit;
}

// событие просмотра — нужно для «завершения» и отчётов
$event = \mod_energy\event\course_module_viewed::create([
    'objectid' => $energy->id,
    'context' => $context,
]);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('energy', $energy);
$event->trigger();

$progress = mod_energy_get_progress($energy, (int)$USER->id);

$PAGE->requires->js_call_amd('mod_energy/bridge', 'init', [[
    'cmid' => (int)$cm->id,
    'benches' => array_values($enabled),
    'sesskey' => sesskey(),
    'solved' => $progress->solved,
    'target' => max(1, (int)$energy->gradetarget),
    'grade' => (float)$energy->grade,
    'startBench' => reset($enabled),
    'open' => $open,
]]);

echo $OUTPUT->header();

echo html_writer::start_div('mod-energy-wrap');
echo html_writer::div(format_text($energy->intro, $energy->introformat ?? FORMAT_HTML), 'mod-energy-intro');

// сводка прогресса
echo html_writer::start_div('mod-energy-progress card p-2 mb-2');
echo html_writer::tag('div', get_string('your_progress', 'mod_energy'), ['class' => 'fw-bold small text-uppercase text-muted']);
echo html_writer::tag('div',
    get_string('tasks_done', 'mod_energy', ['done' => mod_energy_count_solved($progress->solved), 'total' => mod_energy_total_tasks($energy)]),
    ['class' => 'mod-energy-progress-text', 'id' => 'mod-energy-progress']);
echo html_writer::start_div('progress mt-1', ['style' => 'height:8px']);
echo html_writer::div('', 'progress-bar bg-success', [
    'id' => 'mod-energy-bar',
    'role' => 'progressbar',
    'style' => 'width:' . $progress->percent . '%',
]);
echo html_writer::end_div();
echo html_writer::end_div();

// сам стенд
echo html_writer::tag('div', '', [
    'id' => 'mod-energy-root',
    'class' => 'mod-energy-root',
    'data-bench' => reset($enabled),
]);

if ($isstaff) {
    echo html_writer::link(new moodle_url('/mod/energy/report.php', ['id' => $cm->id]),
        get_string('report', 'mod_energy'), ['class' => 'btn btn-secondary btn-sm mt-2']);
}

echo html_writer::end_div();

echo $OUTPUT->footer();
