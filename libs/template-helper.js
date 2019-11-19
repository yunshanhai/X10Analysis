const config = require('../config');
const fs = require('fs');
const util = require('../util')

exports.create_empty_book = (book_name, size_id) => {
    return {
        id: 0,
        version: 1,
        author: '小凡',
        name: book_name,
        //规格尺寸id，相当于basebook表
        size_id: size_id,
        fascicule: 0,
        fascicule_type: 0,
        other_thickness: 0,
        pages: [],
        show_page_num: 1,
    };
}

exports.create_empty_page = () => {
    return {
        id: 0,
        type: 'inner',
        background: {
            image: ''
        },
        elements: [],
        is_deleted: 0,
        sort: 0,
        resize: 0,
        resize_width: 0,
        resize_height: 0,
        version: 1,
        position: 'inner'
    };
}

exports.convert_element = (layer, type, refwidth, style_path, template_name) => {
    let width_px = refwidth * layer.location.wscale;
    let element = {
        x: Math.round(refwidth * layer.location.xscale),
        y: Math.round(refwidth * layer.location.yscale),
        width: Math.round(width_px),
        height: Math.round(width_px * layer.location.hwscale),
        shape: 'rect',
        type: type,
        angle: Math.abs(parseInt(layer.location.rotation)),
        rect: {
            r: 0,
            is_square: false
        },
        is_stroke: false,
        stroke: 'white',
        stroke_width: 0,
        stroke_opacity: 100,
        stroke_dasharray: '',
        is_fill: true,
        fill: 'none',
        fill_opacity: 100,
        display: true,
        fixed: layer.location.fixed == 'false' ? false : true,
        index: layer.index,
        position: 'default' // 普通页默认default，封面页分五个区，封底为back，封面为cover，书脊为spine，封底折页为back_fold，封面折页为cover_fold
    };

    if (type == 'photo') {
        element.image = {
            id: null,
            url: null, 
            width: 0,
            height: 0,
            flag: null, //横竖图标识，横图：h，竖图：v
            filetype: null,
            filename: null,
            filesize: 0,
            mode: 0, // 0:slice,1:meet
            angle: 0,
            scale: 1,
            translate_x: -1,
            translate_y: -1
        };
    } else if (type === 'decorate') {
        let oldStr = 'com://' + style_path + config.x10.decorate_folder;
        let newStr = config.my.web_root + template_name + '/' + config.my.decorate_folder
        element.image = {
            url: null
        }
        element.image.url = layer.image.property.url.replace(/\\/g, '/').replace(/\/\/\//g, '//').replace(oldStr, newStr)
    } else if (type == 'text') {
        element.text = {
            content: layer.property.content,
            mode: layer.property.textModel,//text|label
            properties: {
                fontSize: util.px2px(layer.property.size * layer.property.scaleX, 72, 300),
                lineHeight: layer.property.lineHeight,
                fontFamily: layer.property.font,
                color: layer.property.color,
                fontWeight: layer.property.bold,
                letterSpacing: layer.property.charSpacing,
                fontStyle: layer.property.italic ? 'italic' : 'normal',
                align: layer.property.align
            },
            textDecoration: layer.property.underline ? 'underline' : 'none',
            lines: [],
            // drawBox: {
            //     x: 0,
            //     y: 0,
            //     width: 0,
            //     height: 0
            // }
        }
    }

    return element;
}

exports.convert_resource_json = (file_path, type, style_path, template_name) => {
    let new_json = [];

    let urlSearch = '';
    let urlReplace = '';
    if (type == 'background') {
        urlSearch = 'com://\\' + style_path.replace(/\//g, '\\') + config.x10.background_folder + '\\';
        urlReplace = config.my.web_root + template_name + '/' + config.my.background_folder + '/';
    } else if (type == 'layout') {
        urlSearch = 'com://\\' + style_path.replace(/\//g, '\\') + config.x10.layout_folder + '\\';
        urlReplace = config.my.web_root + template_name + '/' + config.my.layout_folder + '/';
    } else if (type == 'decorate') {
        urlSearch = 'com://\\' + style_path.replace(/\//g, '\\') + config.x10.decorate_folder + '\\';
        urlReplace = config.my.web_root + template_name + '/' + config.my.decorate_folder + '/';
    }

    if(fs.existsSync(file_path)){
        let json = JSON.parse(fs.readFileSync(file_path).toString());
        let items = json.template.groups.group[0].items.item;
        items.forEach(element => {
            let url = '';
            // 兼容com://\\和com:/\\，将com:/\\替换为com://\\
            if(element.url.indexOf('com://')===-1){
                url = element.url.replace('com:/', 'com://');
            }else{
                url = element.url;
            }
            url = url.replace(urlSearch, urlReplace);
            new_json.push(url);
        });
    }else{
        console.log('转化' + type + '的文件不存在：' + file_path)
    }
    
    return new_json;
}