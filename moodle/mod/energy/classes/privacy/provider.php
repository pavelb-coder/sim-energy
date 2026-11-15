<?php
// Провайдер приватности (GDPR/152-ФЗ): хранение и удаление прогресса студента.

namespace mod_energy\privacy;

defined('MOODLE_INTERNAL') || die();

use context;
use context_module;
use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\core_userlist_provider,
    \core_privacy\local\request\plugin\provider {

    /**
     * Описание хранимых данных.
     *
     * @param collection $collection
     * @return collection
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('energy_progress', [
            'energyid' => 'privacy:metadata:energy_progress:energyid',
            'userid' => 'privacy:metadata:energy_progress:userid',
            'solved' => 'privacy:metadata:energy_progress:solved',
            'stars' => 'privacy:metadata:energy_progress:stars',
            'best' => 'privacy:metadata:energy_progress:best',
            'timemodified' => 'privacy:metadata:energy_progress:timemodified',
        ], 'privacy:metadata:energy_progress');

        return $collection;
    }

    /**
     * Контексты, в которых есть данные пользователя.
     *
     * @param int $userid
     * @return contextlist
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        global $DB;

        $sql = "SELECT ctx.id
                  FROM {context} ctx
                  JOIN {course_modules} cm ON cm.id = ctx.instanceid AND ctx.contextlevel = :modulelevel
                  JOIN {modules} m ON m.id = cm.module AND m.name = :modname
                  JOIN {energy_progress} p ON p.energyid = cm.instance
                 WHERE p.userid = :userid";
        $params = [
            'modulelevel' => CONTEXT_MODULE,
            'modname' => 'energy',
            'userid' => $userid,
        ];

        $contextlist = new contextlist();
        $contextlist->add_from_sql($sql, $params);
        return $contextlist;
    }

    /**
     * Пользователи, у которых есть данные в контексте.
     *
     * @param userlist $userlist
     * @return void
     */
    public static function get_users_in_context(userlist $userlist): void {
        $context = $userlist->get_context();
        if (!$context instanceof context_module) {
            return;
        }
        $sql = "SELECT p.userid
                  FROM {energy_progress} p
                  JOIN {course_modules} cm ON cm.instance = p.energyid
                 WHERE cm.id = :cmid";
        $userlist->add_from_sql('userid', $sql, ['cmid' => $context->instanceid]);
    }

    /**
     * Экспорт данных пользователя.
     *
     * @param approved_contextlist $contextlist
     * @return void
     */
    public static function export_user_data(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            if (!$context instanceof context_module) {
                continue;
            }
            $cm = get_coursemodule_from_id('energy', $context->instanceid);
            if (!$cm) {
                continue;
            }
            $record = $DB->get_record('energy_progress', ['energyid' => $cm->instance, 'userid' => $userid]);
            if (!$record) {
                continue;
            }
            $data = (object)[
                'solved' => json_decode((string)$record->solved, true),
                'stars' => json_decode((string)$record->stars, true),
                'percent' => (int)round(100 * (float)$record->best),
                'timemodified' => \core_privacy\local\request\transform::datetime($record->timemodified),
            ];
            writer::with_context($context)->export_data([get_string('pluginname', 'mod_energy')], $data);
        }
    }

    /**
     * Удаление данных во всех контекстах курса.
     *
     * @param context $context
     * @return void
     */
    public static function delete_data_for_all_users_in_context(context $context): void {
        global $DB;

        if (!$context instanceof context_module) {
            return;
        }
        $cm = get_coursemodule_from_id('energy', $context->instanceid);
        if ($cm) {
            $DB->delete_records('energy_progress', ['energyid' => $cm->instance]);
        }
    }

    /**
     * Удаление данных одного пользователя.
     *
     * @param approved_contextlist $contextlist
     * @return void
     */
    public static function delete_data_for_user(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            if (!$context instanceof context_module) {
                continue;
            }
            $cm = get_coursemodule_from_id('energy', $context->instanceid);
            if ($cm) {
                $DB->delete_records('energy_progress', ['energyid' => $cm->instance, 'userid' => $userid]);
            }
        }
    }

    /**
     * Удаление данных нескольких пользователей.
     *
     * @param approved_userlist $userlist
     * @return void
     */
    public static function delete_data_for_users(approved_userlist $userlist): void {
        global $DB;

        $context = $userlist->get_context();
        if (!$context instanceof context_module) {
            return;
        }
        $cm = get_coursemodule_from_id('energy', $context->instanceid);
        if (!$cm) {
            return;
        }
        [$insql, $inparams] = $DB->get_in_or_equal($userlist->get_userids(), SQL_PARAMS_NAMED);
        $DB->delete_records_select('energy_progress',
            "energyid = :energyid AND userid $insql",
            ['energyid' => $cm->instance] + $inparams);
    }
}
