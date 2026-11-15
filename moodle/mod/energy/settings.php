<?php
// Глобальные настройки модуля.

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_configcheckbox(
        'mod_energy/showreports',
        get_string('report', 'mod_energy'),
        get_string('gradetarget_help', 'mod_energy'),
        1
    ));
}
