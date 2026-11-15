<?php
// Бэкап активности: сохраняем настройки стенда вместе с курсом.

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/energy/backup/moodle2/backup_energy_stepslib.php');

class backup_energy_activity_task extends backup_activity_task {

    /**
     * Настройки, специфичные для модуля (нет).
     */
    protected function define_my_settings(): void {
    }

    /**
     * Шаги бэкапа.
     */
    protected function define_my_steps(): void {
        $this->add_step(new backup_energy_activity_structure_step('energy_structure', 'energy.xml'));
    }

    /**
     * Переписывает ссылки на файлы/активность в тексте.
     *
     * @param string $content
     * @return string
     */
    public static function encode_content_links($content) {
        global $CFG;

        $base = preg_quote($CFG->wwwroot . '/mod/energy', '#');
        $content = preg_replace('#(' . $base . '/index\.php\?id=)([0-9]+)#', '$@ENERGYINDEX*$2@$', $content);
        $content = preg_replace('#(' . $base . '/view\.php\?id=)([0-9]+)#', '$@ENERGYVIEWBYID*$2@$', $content);
        return $content;
    }
}
