<?php
// Форма создания и редактирования активности «Виртуальная лаборатория».

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');
require_once(__DIR__ . '/lib.php');

class mod_energy_mod_form extends moodleform_mod {

    public function definition(): void {
        $mform = $this->_form;

        // --- Основное ---
        $mform->addElement('header', 'general', get_string('general', 'form'));

        $mform->addElement('text', 'name', get_string('name'), ['size' => 64]);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');

        $this->standard_intro_elements(get_string('intro', 'mod_energy'));

        // --- Какие стенды доступны ---
        $mform->addElement('header', 'benchheader', get_string('benches_header', 'mod_energy'));
        $mform->addElement('static', 'benchdesc', '', get_string('benches_desc', 'mod_energy'));

        $benches = mod_energy_bench_list();
        $options = [];
        foreach ($benches as $key => $title) {
            $options[$key] = $title;
        }
        $select = $mform->addElement('select', 'benchess', get_string('benches', 'mod_energy'), $options,
            ['size' => count($options)]);
        $select->setMultiple(true);
        $mform->setType('benchess', PARAM_TEXT);
        $mform->setDefault('benchess', array_keys($options));

        $mform->addElement('text', 'gradetarget', get_string('gradetarget', 'mod_energy'), ['size' => 6]);
        $mform->setType('gradetarget', PARAM_INT);
        $mform->setDefault('gradetarget', 3);
        $mform->addHelpButton('gradetarget', 'gradetarget', 'mod_energy');

        // --- Оценка и завершение ---
        $mform->addElement('header', 'gradeheader', get_string('grades', 'grades'));
        $mform->addElement('text', 'grade', get_string('grademax', 'grades'), ['size' => 6]);
        $mform->setType('grade', PARAM_FLOAT);
        $mform->setDefault('grade', 100);
        $mform->addHelpButton('grade', 'grademax', 'grades');

        // --- Доступность и сроки ---
        $mform->addElement('header', 'availheader', get_string('availability', 'availability'));
        $mform->addElement('date_time_selector', 'timeopen', get_string('timeopen', 'mod_energy'),
            ['optional' => true, 'step' => 5]);
        $mform->addElement('date_time_selector', 'timeclose', get_string('timeclose', 'mod_energy'),
            ['optional' => true, 'step' => 5]);

        // --- Стандартные элементы курса (видимость, группы, завершение и т.п.) ---
        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    /**
     * Проверка полей перед сохранением.
     *
     * @param array $data
     * @param array $files
     * @return array
     */
    public function validation($data, $files): array {
        $errors = parent::validation($data, $files);

        if (!empty($data['timeopen']) && !empty($data['timeclose'])
                && $data['timeclose'] < $data['timeopen']) {
            $errors['timeclose'] = get_string('err_closebeforeopen', 'mod_energy');
        }
        if (isset($data['gradetarget']) && (int)$data['gradetarget'] < 1) {
            $errors['gradetarget'] = get_string('err_gradetarget', 'mod_energy');
        }
        return $errors;
    }
}
