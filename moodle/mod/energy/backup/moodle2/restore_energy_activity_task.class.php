<?php
// Восстановление активности из бэкапа курса.

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/energy/backup/moodle2/restore_energy_stepslib.php');

class restore_energy_activity_task extends restore_activity_task {

    /**
     * Настройки восстановления (нет).
     */
    protected function define_my_settings(): void {
    }

    /**
     * Шаги восстановления.
     */
    protected function define_my_steps(): void {
        $this->add_step(new restore_energy_activity_structure_step('energy_structure', 'energy.xml'));
    }

    /**
     * Дополнительные файлы (нет).
     */
    protected function define_my_roles(): void {
    }

    /**
     * Куда привязывать файлы.
     */
    public static function define_decode_contents() {
        return [new restore_decode_content('energy', ['intro'], 'energy')];
    }

    /**
     * Правила декодирования ссылок.
     */
    public static function define_decode_rules() {
        return [
            new restore_decode_rule('ENERGYVIEWBYID', '/mod/energy/view.php?id=$1', 'course_module'),
            new restore_decode_rule('ENERGYINDEX', '/mod/energy/index.php?id=$1', 'course'),
        ];
    }
}
