<?php
// AJAX-функция: стенд присылает список выполненных заданий и получает обновлённую оценку.

namespace mod_energy\external;

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->libdir . '/externallib.php');
require_once($CFG->dirroot . '/mod/energy/lib.php');

use context_module;
use external_api;
use external_function_parameters;
use external_single_structure;
use external_value;

class save_progress extends external_api {

    /**
     * Описание параметров.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid'    => new external_value(PARAM_INT, 'id элемента курса'),
            'bench'   => new external_value(PARAM_ALPHAEXT, 'ключ стенда: circuits|renew|storage|efficiency'),
            'solved'  => new external_value(PARAM_RAW, 'JSON вида {"0":3,"2":1} — номер задания → звёзды'),
        ]);
    }

    /**
     * Сохраняет прогресс и пересчитывает оценку.
     *
     * @param int $cmid
     * @param string $bench
     * @param string $solved
     * @return array
     */
    public static function execute(int $cmid, string $bench, string $solved): array {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
            'bench' => $bench,
            'solved' => $solved,
        ]);

        [$course, $cm, $energy] = mod_energy_get_instance($params['cmid']);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/energy:submit', $context);

        $allowed = mod_energy_enabled_benches($energy);
        if (!in_array($params['bench'], $allowed, true)) {
            throw new \moodle_exception('invalidrecord', 'error');
        }
        if (!mod_energy_is_open($energy)) {
            throw new \moodle_exception('closed', 'mod_energy');
        }

        $incoming = json_decode($params['solved'], true);
        if (!is_array($incoming)) {
            $incoming = [];
        }

        $now = time();
        $row = $DB->get_record('energy_progress', ['energyid' => $energy->id, 'userid' => $USER->id]);
        $all = $row ? (json_decode((string)$row->solved, true) ?: []) : [];

        // прогресс только накапливается: выполненные задания не «сгорают»
        $current = isset($all[$params['bench']]) ? (array)$all[$params['bench']] : [];
        foreach ($incoming as $task => $stars) {
            $task = (string)(int)$task;
            $stars = max(1, min(3, (int)$stars));
            if (!isset($current[$task]) || (int)$current[$task] < $stars) {
                $current[$task] = $stars;
            }
        }
        $all[$params['bench']] = $current;

        $solvedcount = 0;
        $starssum = 0;
        foreach ($all as $tasks) {
            foreach ((array)$tasks as $stars) {
                $solvedcount++;
                $starssum += (int)$stars;
            }
        }
        $target = max(1, (int)$energy->gradetarget);
        $fraction = min(1.0, $solvedcount / $target);

        $record = (object)[
            'energyid' => $energy->id,
            'userid' => $USER->id,
            'solved' => json_encode($all),
            'stars' => json_encode($starssum),
            'best' => $fraction,
            'timemodified' => $now,
        ];
        if ($row) {
            $record->id = $row->id;
            $DB->update_record('energy_progress', $record);
        } else {
            $record->timecreated = $now;
            $DB->insert_record('energy_progress', $record);
        }

        mod_energy_update_grade($energy, (int)$USER->id, $fraction);

        return [
            'solved' => $solvedcount,
            'stars' => $starssum,
            'percent' => (int)round(100 * $fraction),
            'grade' => mod_energy_grade_for($fraction, (float)$energy->grade),
            'message' => get_string('saved', 'mod_energy'),
        ];
    }

    /**
     * Что возвращаем в браузер.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'solved' => new external_value(PARAM_INT, 'выполнено заданий всего'),
            'stars' => new external_value(PARAM_INT, 'сумма звёзд'),
            'percent' => new external_value(PARAM_INT, 'процент выполнения'),
            'grade' => new external_value(PARAM_FLOAT, 'текущий балл'),
            'message' => new external_value(PARAM_TEXT, 'сообщение для студента'),
        ]);
    }
}
