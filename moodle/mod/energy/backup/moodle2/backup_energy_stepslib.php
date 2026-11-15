<?php
// Структура данных, попадающих в бэкап.

defined('MOODLE_INTERNAL') || die();

class backup_energy_activity_structure_step extends backup_activity_structure_step {

    /**
     * Описание структуры.
     *
     * @return backup_nested_element
     */
    protected function define_structure() {
        $energy = new backup_nested_element('energy', ['id'], [
            'name', 'intro', 'introformat', 'benchess', 'gradetarget', 'grade',
            'timeopen', 'timeclose', 'timecreated', 'timemodified',
        ]);

        // прогресс студентов в бэкап курса не включаем: он персональный
        $energy->set_source_table('energy', ['id' => backup::VAR_ACTIVITYID]);

        $energy->annotate_files('mod_energy', 'intro', null);

        return $this->prepare_activity_structure($energy);
    }
}
