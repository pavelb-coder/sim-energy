<?php
// Отчёт для преподавателя: кто сколько заданий выполнил.

require('../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT);
$download = optional_param('download', '', PARAM_ALPHA);

[$course, $cm, $energy] = mod_energy_get_instance($id);
$context = context_module::instance($cm->id);
require_capability('mod/energy:viewreports', $context);

$PAGE->set_url('/mod/energy/report.php', ['id' => $cm->id]);
$PAGE->set_title(get_string('report', 'mod_energy'));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');

$rows = mod_energy_report_rows($energy, $context);

if ($download === 'csv') {
    $filename = clean_filename($energy->name . '-report.csv');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM для Excel
    fputcsv($out, [
        get_string('report_student', 'mod_energy'),
        get_string('report_solved', 'mod_energy'),
        get_string('report_stars', 'mod_energy'),
        get_string('report_percent', 'mod_energy'),
        get_string('report_time', 'mod_energy'),
    ], ';');
    foreach ($rows as $r) {
        fputcsv($out, [$r->fullname, $r->solved, $r->stars, $r->percent, userdate($r->time)], ';');
    }
    fclose($out);
    exit;
}

echo $OUTPUT->header();
echo $OUTPUT->heading(format_string($energy->name) . ': ' . get_string('report', 'mod_energy'));

if (!$rows) {
    echo $OUTPUT->notification(get_string('report_empty', 'mod_energy'), 'info');
} else {
    $table = new html_table();
    $table->head = [
        get_string('report_student', 'mod_energy'),
        get_string('report_solved', 'mod_energy'),
        get_string('report_stars', 'mod_energy'),
        get_string('report_percent', 'mod_energy'),
        get_string('report_time', 'mod_energy'),
    ];
    $table->attributes['class'] = 'table table-sm table-striped generaltable';
    foreach ($rows as $r) {
        $table->data[] = [
            html_writer::link(new moodle_url('/user/view.php', ['id' => $r->userid, 'course' => $course->id]), $r->fullname),
            $r->solved,
            $r->stars,
            $r->percent . ' %',
            userdate($r->time, get_string('strftimedatetimeshort', 'langconfig')),
        ];
    }
    echo html_writer::table($table);
    echo html_writer::link(new moodle_url('/mod/energy/report.php', ['id' => $cm->id, 'download' => 'csv']),
        'CSV', ['class' => 'btn btn-outline-secondary btn-sm']);
}

echo html_writer::div(html_writer::link(new moodle_url('/mod/energy/view.php', ['id' => $cm->id]),
    get_string('back')), 'mt-3');

echo $OUTPUT->footer();
