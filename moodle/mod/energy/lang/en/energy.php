<?php
// Language strings (English fallback).

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Energyquantum virtual laboratory';
$string['modulename'] = 'Virtual laboratory';
$string['modulenameplural'] = 'Virtual laboratories';
$string['modulename_help'] = 'Interactive energy stands: electric circuits, renewables, storage and converters, energy efficiency, hydrogen loop, microgrid. Students complete tasks on the stands; progress is written to the gradebook automatically.';
$string['pluginadministration'] = 'Virtual laboratory administration';

$string['energy:addinstance'] = 'Add a virtual laboratory to the course';
$string['energy:view'] = 'Open the virtual laboratory';
$string['energy:submit'] = 'Save results from the stands';
$string['energy:viewreports'] = 'View students reports';

$string['intro'] = 'Description';
$string['benches'] = 'Available stands';
$string['benches_header'] = 'Stands';
$string['benches_desc'] = 'Select the stands available to students in this activity.';
$string['bench_circuits'] = 'Electric circuits';
$string['bench_renew'] = 'Renewable energy';
$string['bench_storage'] = 'Storage and converters';
$string['bench_efficiency'] = 'Energy efficiency and smart home';
$string['bench_hydrogen'] = 'Hydrogen loop (FCJJ-40)';
$string['bench_grid'] = 'Microgrid and EV charging';
$string['bench_mech'] = 'Mechanics and energy';
$string['bench_thermal'] = 'Heat and gases';

$string['gradetarget'] = 'Tasks for the full grade';
$string['gradetarget_help'] = 'How many tasks a student must complete to get the maximum grade.';

$string['timeopen'] = 'Open from';
$string['timeclose'] = 'Close after';
$string['err_closebeforeopen'] = 'The closing date is earlier than the opening date';
$string['err_gradetarget'] = 'Enter a positive number of tasks';

$string['closed'] = 'The laboratory is closed.';
$string['notopenyet'] = 'The laboratory opens {$a}.';
$string['closedsince'] = 'The laboratory was closed {$a}.';

$string['progress'] = 'Progress';
$string['tasks_done'] = 'Tasks completed: {$a->done} of {$a->total}';
$string['your_progress'] = 'Your progress';
$string['saved'] = 'Result saved';
$string['grade_saved'] = 'Grade updated: {$a}';
$string['report'] = 'Students report';
$string['report_student'] = 'Student';
$string['report_solved'] = 'Tasks completed';
$string['report_stars'] = 'Stars';
$string['report_percent'] = 'Percent';
$string['report_time'] = 'Last activity';
$string['report_empty'] = 'Nobody has worked in the laboratory yet.';
$string['nopermission'] = 'You are not allowed to do this';
$string['privacy:metadata'] = 'The plugin stores information about tasks completed by the student on each stand.';
$string['privacy:metadata:energyid'] = 'Activity instance';
$string['privacy:metadata:energy_progress'] = 'Student progress on the stands';
$string['privacy:metadata:energy_progress:userid'] = 'User';
$string['privacy:metadata:energy_progress:solved'] = 'Completed tasks per stand';
$string['privacy:metadata:energy_progress:stars'] = 'Stars per completed task';
$string['privacy:metadata:energy_progress:best'] = 'Fraction of completed tasks (0…1)';
$string['privacy:metadata:energy_progress:timemodified'] = 'Time of the last save';
