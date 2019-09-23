const x10_root = '../X10/';
const x10 = {
    db:                 x10_root + 'application.db',
    resource:           x10_root + 'resource/',
    global:             x10_root + 'resource/globalres/',
    layout_file:        'psd_layout.json',
    decorate_file:      'decorate.json',
    background_file:    'background.json',
    template_file:      'style.json',
    layout_folder:      'psd',
    decorate_folder:    'decorate',
    background_folder:  'background'
};

const my = {
    root:               './templates/',
    web_root:           '/templates/',
    layout_file:        'layout.json',
    decorate_file:      'decorate.json',
    background_file:    'background.json',
    template_file:      'template.json',
    layout_folder:      'layout',
    decorate_folder:    'decorate',
    background_folder:  'background'
}

const mysql = { 
    host: '192.168.31.31', 
    port: 3301, 
    user: '', 
    password: '', 
    database: '' 
}

module.exports = {
    x10,
    my,
    mysql
};