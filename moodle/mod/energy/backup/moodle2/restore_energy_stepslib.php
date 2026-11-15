<?php
// Шаг восстановления: создаём экземпляр активности.

defined('MOODLE_INTERNAL') || die();

class restore_energy_activity_structure_step extends restore_activity_structure_step {

    /**
     * Описание структуры.
     *
     * @return restore_path_element[]
     */
    protected function define_structure() {
        $paths = [];
        $paths[] = new restore_path_element('energy', '/activity/energy');
        return $this->prepare_activity_structure($paths);
    }

    /**
     * Обработка элемента.
     *
     * @param array $data
     */
    protected function process_energy($data) {
        global $DB;

        $data = (object)$data;
        $data->course = $this->get_courseid();
        $data->timemodified = time();
        $data->timecreated = time();

        $newitemid = $DB->insert_record('energy', $data);
        $this->apply_activity_instance($newitemid);
    }

    /**
     * После восстановления.
     */
    protected function after_execute(): void {
        $this->add_related_files('mod_energy', 'intro', null);
    }
}
