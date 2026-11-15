<?php
// Веб-сервис: стенд отправляет прогресс в Moodle без перезагрузки страницы.

defined('MOODLE_INTERNAL') || die();

$functions = [
    'mod_energy_save_progress' => [
        'classname'   => 'mod_energy\external\save_progress',
        'description' => 'Сохраняет прогресс студента по заданиям стенда',
        'type'        => 'write',
        'ajax'        => true,
        'capabilities'=> 'mod/energy:submit',
    ],
];

$services = [
    'Виртуальная лаборатория «Энерджиквантум»' => [
        'functions' => ['mod_energy_save_progress'],
        'restrictedusers' => 0,
        'enabled' => 1,
        'shortname' => 'mod_energy',
    ],
];
