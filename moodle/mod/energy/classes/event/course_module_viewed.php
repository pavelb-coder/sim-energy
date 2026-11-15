<?php
// Событие «стенд открыт» — используется для завершения элемента курса и отчётов.

namespace mod_energy\event;

defined('MOODLE_INTERNAL') || die();

class course_module_viewed extends \core\event\course_module_viewed {

    /**
     * Инициализация данных события.
     *
     * @return void
     */
    protected function init(): void {
        $this->data['crud'] = 'r';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = 'energy';
    }

    /**
     * Сопоставление с таблицей при восстановлении из бэкапа.
     *
     * @return string
     */
    public static function get_objectid_mapping(): array {
        return ['db' => 'energy', 'restore' => 'energy'];
    }
}
