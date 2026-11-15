<?php
// Список всех виртуальных лабораторий курса.

require('../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT); // id курса

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);
require_course_login($course);

$PAGE->set_url('/mod/energy/index.php', ['id' => $id]);
$PAGE->set_title(format_string($course->fullname) . ': ' . get_string('modulenameplural', 'mod_energy'));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_pagelayout('incourse');

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'mod_energy'));

$instances = get_all_instances_in_course('energy', $course);
if (!$instances) {
    echo $OUTPUT->notification(get_string('thereareno', 'moodle', get_string('modulenameplural', 'mod_energy')), 'info');
    echo $OUTPUT->footer();
    exit;
}

$table = new html_table();
$table->head = [get_string('name'), get_string('progress', 'mod_energy')];
$table->attributes['class'] = 'table generaltable';

foreach ($instances as $instance) {
    $progress = mod_energy_get_progress($instance, (int)$USER->id);
    $url = new moodle_url('/mod/energy/view.php', ['id' => $instance->coursemodule]);
    $table->data[] = [
        html_writer::link($url, format_string($instance->name)),
        $progress->percent . ' %',
    ];
}
echo html_writer::table($table);

echo $OUTPUT->footer();
