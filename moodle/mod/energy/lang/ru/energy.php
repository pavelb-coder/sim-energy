<?php
// Таблицы плагина.

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Виртуальная лаборатория «Энерджиквантум»';
$string['modulename'] = 'Виртуальная лаборатория';
$string['modulenameplural'] = 'Виртуальные лаборатории';
$string['modulename_help'] = 'Интерактивные стенды по энергетике: электрические цепи, возобновляемая энергетика, накопители и преобразователи, энергоэффективность, водородный контур, микросеть. Студент выполняет задания на стендах, прогресс автоматически попадает в журнал оценок.';
$string['pluginadministration'] = 'Управление виртуальной лабораторией';

$string['energy:addinstance'] = 'Добавлять виртуальную лабораторию в курс';
$string['energy:view'] = 'Открывать виртуальную лабораторию';
$string['energy:submit'] = 'Сохранять результаты работы на стендах';
$string['energy:viewreports'] = 'Смотреть отчёты о работе студентов';

$string['intro'] = 'Описание';
$string['benches'] = 'Доступные стенды';
$string['benches_header'] = 'Стенды';
$string['benches_desc'] = 'Отметьте стенды, которые будут доступны студенту в этой активности.';
$string['bench_circuits'] = 'Электрические цепи';
$string['bench_renew'] = 'Возобновляемая энергетика';
$string['bench_storage'] = 'Накопители и преобразователи';
$string['bench_efficiency'] = 'Энергоэффективность и умный дом';
$string['bench_hydrogen'] = 'Водородный контур (FCJJ-40)';
$string['bench_grid'] = 'Микросеть и зарядка электромобиля';

$string['gradetarget'] = 'Заданий для полного балла';
$string['gradetarget_help'] = 'Сколько заданий нужно выполнить, чтобы получить максимальную оценку. Если заданий больше, чем это число, оценка всё равно не превысит максимум.';

$string['timeopen'] = 'Открыть с';
$string['timeclose'] = 'Закрыть после';
$string['err_closebeforeopen'] = 'Дата закрытия раньше даты открытия';
$string['err_gradetarget'] = 'Укажите положительное число заданий';

$string['closed'] = 'Лаборатория закрыта.';
$string['notopenyet'] = 'Лаборатория откроется {$a}.';
$string['closedsince'] = 'Лаборатория была закрыта {$a}.';

$string['progress'] = 'Прогресс';
$string['tasks_done'] = 'Выполнено заданий: {$a->done} из {$a->total}';
$string['your_progress'] = 'Ваш прогресс';
$string['saved'] = 'Результат сохранён';
$string['grade_saved'] = 'Оценка обновлена: {$a}';
$string['report'] = 'Отчёт по студентам';
$string['report_student'] = 'Студент';
$string['report_solved'] = 'Заданий выполнено';
$string['report_stars'] = 'Звёзд';
$string['report_percent'] = 'Процент';
$string['report_time'] = 'Последняя работа';
$string['report_empty'] = 'Пока никто не работал в лаборатории.';
$string['nopermission'] = 'Недостаточно прав для этого действия';
$string['privacy:metadata'] = 'Плагин хранит данные о выполненных заданиях студента в каждом стенде.';
$string['privacy:metadata:energyid'] = 'Экземпляр активности';
$string['privacy:metadata:energy_progress'] = 'Прогресс студента по стендам';
$string['privacy:metadata:energy_progress:userid'] = 'Пользователь';
$string['privacy:metadata:energy_progress:solved'] = 'Список выполненных заданий по стендам';
$string['privacy:metadata:energy_progress:stars'] = 'Оценка в звёздах по выполненным заданиям';
$string['privacy:metadata:energy_progress:best'] = 'Доля выполненных заданий (0…1)';
$string['privacy:metadata:energy_progress:timemodified'] = 'Время последнего сохранения';
