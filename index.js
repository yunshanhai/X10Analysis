// import {sqlite} from 'sqlite';
const sqlite = require('sqlite');
const fs = require('fs');
const sizes = require('./sizes');
const config = require('./config');
const util = require('./util');
const mysql_query = require('./mysql_query');

//x10相关目录
const x10 = config.x10;

//转化后相关
const my = config.my;

const global = {
    template_name: '',
    style: null
}

//如果查询到多个同名模板名称，需要设置index对应的行索引，并且设置multi_row=true;
//style_name:x10模板的中文名，template_name:转化为我们的模板的文件夹名，id：模板的id
//使用模板的中文名查询到多条记录，需要将multi_row设置为true再转换，并且设置要转换哪条数据，使用索引index指定
async function main(style_name, template_name, id, multi_row = false, index = 0) {
    global.template_name = template_name;

    const db = await sqlite.open(x10.db);
    const rows = await db.all('select * from xc_product_style where style_name=?', style_name);
    if (rows.length > 1 && !multi_row) {
        console.log(`**查询到多条【${style_name}】，请设置要解析那一条，修改代码multi_row和index`);
        console.log('');
        console.log('style_id\t模板名称\t\t模板类型');
        console.log('------------------------------------------------');
        rows.forEach(item => {
            console.log(`${item.style_id}\t\t${item.style_name}\t\t${item.category_name}`);
        });
        return;
    }
    if (rows.length == 0) {
        console.log(`未查询到【${style_name}】，请确认要解析的模板是否已下载`);
        return;
    }

    //----------------------------------------------------------------
    let style = rows[index];
    global.style = style;

    let style_dir = x10.resource + style.style_path;
    if (!fs.existsSync(style_dir)) {
        console.log('路径不存在：' + style_dir);
        return;
    }

    //创建模板文件夹
    let template_path = my.root + template_name + '/';

    if (fs.existsSync(template_path)) {
        console.log('模板文件夹已存在，移除原文件夹：' + template_path);
        util.rmdir(template_path);
    }

    console.log('创建模板文件夹：' + template_path);
    fs.mkdirSync(template_path);

    console.log('创建布局文件夹');
    fs.mkdirSync(template_path + my.layout_folder);
    console.log('拷贝布局文件夹');
    util.copydirSync(style_dir + x10.layout_folder, template_path + my.layout_folder);
    console.log('转化布局文件:' + x10.layout_file);
    let new_json = convert_resource_json(style_dir + x10.layout_file, 'layout');
    // fs.writeFileSync(template_path + my.layout_file, JSON.stringify(new_json));
    console.log('转化布局里每一个布局文件');
    let layouts = [];
    for (let i = 0; i < new_json.length; i++) {
        let layout_json = convert_layout_json('.' + new_json[i], i);
        layouts.push(layout_json);
        // fs.writeFileSync('.' + new_json[i], JSON.stringify(layout_json));
    }
    fs.writeFileSync(template_path + my.layout_file, JSON.stringify(layouts));

    console.log('转化背景文件:' + x10.background_file);
    new_json = convert_resource_json(style_dir + x10.background_file, 'background');
    fs.writeFileSync(template_path + my.background_file, JSON.stringify(new_json));
    console.log('拷贝背景文件夹');
    if(fs.existsSync(style_dir + x10.background_folder)) {
        util.copydir(style_dir + x10.background_folder, template_path + my.background_folder);
    }else{
        console.log('背景文件夹不存在');
    }
    

    console.log('转化装饰文件:' + x10.decorate_file);
    new_json = convert_resource_json(style_dir + x10.decorate_file, 'decorate');
    fs.writeFileSync(template_path + my.decorate_file, JSON.stringify(new_json));
    console.log('拷贝装饰文件夹');
    if(fs.existsSync(style_dir + x10.decorate_folder)) {
        util.copydir(style_dir + x10.decorate_folder, template_path + my.decorate_folder);
    }else{
        console.log('装饰文件夹不存在');
    }

    console.log('转化模板文件：' + x10.template_file);
    new_json = await convert_style_json(style_dir + x10.template_file);
    fs.writeFileSync(template_path + my.template_file, JSON.stringify(new_json));

    console.log('解析结束');
}

async function convert_style_json(file_path) {
    let json = JSON.parse(fs.readFileSync(file_path).toString());
    let new_json = create_empty_book(global.style);

    //----------------------------------------規格---------------------------------------
    console.log('解析模板文件的规格');
    let sql = 'select * from tbl_alb_template_size where id=?';
    let rows = await mysql_query(sql, new_json.size_id);
    let template_size = null;
    if(rows.length == 1){
        template_size = rows[0];
    }else{
        throw('解析出錯，未获取到规格');
    }

    let pageCount = 0;

    //----------------------------------------封面---------------------------------------
    console.log('解析模板文件的封面');
    let outer_pages = json.template.style.album.outer_pages.page;
    let tmp_outer_pages = [];
    for (let i = 0; i < outer_pages.length; i++) {
        let outer_page = outer_pages[i];
        let page = convert_page(outer_page, 'cover');
        page.sort = i;
        page.id = pageCount;
        // new_json.pages.push(page);
        tmp_outer_pages.push(page)

        pageCount++;
    }

    // 有封面（台历等模板没有封面）
    if(tmp_outer_pages.length > 0){
        // x10里，单页面的封面有4个，需要将封面封底合并为自己的一个封面，封面内页和封底内页放到内页的第一页和最后一页
        let cover_page = null

        if (template_size.is_cross === 1){
            // 跨页
            if (tmp_outer_pages.length !== 1) {
                throw `此跨页模板的封面共${tmp_outer_pages.length}个，不是1个，需要特殊处理`
            }
            cover_page = tmp_outer_pages[0]
            
            let halfWidth = template_size.width / 2
            for(let i = 0; i< cover_page.elements.length; i++) {
                let element = cover_page.elements[i]
                if (element.x > halfWidth) {
                    element.x -= halfWidth
                    element.position = 'cover'
                } else {
                    element.position = 'back'
                }
            }

            // cover_page.elements = elements
        } else {
            // 单页
            if (tmp_outer_pages.length !== 4) {
                throw `此单页模板的封面共${tmp_outer_pages.length}个，不是4个，需要特殊处理`
            } else {
                let back_cover = tmp_outer_pages[0];
                let cover = tmp_outer_pages[1];

                for(let i = 0; i < back_cover.elements.length; i++) {
                    back_cover.elements[i].position = 'back'
                }
                // 将封底和封面的元素合并到一页，合并时要处理封面页的索引和x坐标
                for(let i = 0; i< cover.elements.length; i++) {
                    let element = cover.elements[i]
                    element.index += back_cover.elements.length
                    element.position = 'cover'
                    back_cover.elements.push(element)
                }

                cover_page = back_cover
            }
        }
        pageCount = 1;

        new_json.pages.push(cover_page)
    }

    

    //----------------------------------------内页---------------------------------------
    console.log('解析模板文件的内页');
    let inner_pages = json.template.style.album.inner_pages.page;
    for (let i = 0; i < inner_pages.length; i++) {
        let inner_page = inner_pages[i];
        let page = convert_page(inner_page, 'inner');
        page.sort = i;
        page.id = pageCount;
        new_json.pages.push(page);

        pageCount++;
    }

    return new_json;
}

function convert_layout_json(layout_file, index) {
    let page_type = layout_file.indexOf('cover.json') > -1 ? 'cover' : 'inner';
    //传入的是转化后新模板布局layout.json中的项，需转化为x10里的路径
    let page_json = JSON.parse(fs.readFileSync(layout_file).toString());
    let page = convert_page(page_json, page_type);
    page.id = index
    page.sort = index
    return page;
}

function convert_page(x10_page, page_type) {
    let page = create_empty_page();
    page.type = page_type;
    page.position = page_type
    //背景图层
    let urlSearch = 'com://' + global.style.style_path + x10.background_folder;
    let urlReplace = my.web_root + global.template_name + '/' + my.background_folder;
    if(x10_page.hasOwnProperty('background')){
        page.background.image = x10_page.background.background_layer.image.property.url
        page.background.image = page.background.image.replace(/\\/g, '/')
        page.background.image = page.background.image.replace(/\/\/\//g, '//')
        page.background.image = page.background.image.replace(urlSearch, urlReplace);
    } else {
        page.background.image = null
    }
    

    //装饰
    for (let i in x10_page.contents.decorate_layer) {
        let layer = x10_page.contents.decorate_layer[i];
        let element = convert_element(layer, 'decorate', x10_page.location.refwidth);
        page.elements.push(element);
    }

    //照片
    for (let i in x10_page.contents.photo_layer) {
        let layer = x10_page.contents.photo_layer[i];
        let element = convert_element(layer, 'photo', x10_page.location.refwidth);
        page.elements.push(element);
    }

    //文字
    for (let i in x10_page.contents.text_layer) {
        let layer = x10_page.contents.text_layer[i];
        let element = convert_element(layer, 'text', x10_page.location.refwidth);
        page.elements.push(element);
    }

    page.elements.sort((a, b) => a.index - b.index);

    // // 重新设置index，index从0开始
    // for(let i = 0; i < page.elements.length; i++) {
    //     page.elements[i].index = i
    // }

    // 重新设置index，index从0开始
    for(let i = 0; i < page.elements.length; i++) {
        delete page.elements[i].index
    }

    return page;
}

function convert_element(layer, type, refwidth) {
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
        let oldStr = 'com://' + global.style.style_path + x10.decorate_folder;
        let newStr = my.web_root + global.template_name + '/' + my.decorate_folder
        element.image = {
            url: null
        }
        element.image.url = layer.image.property.url.replace(/\\/g, '/').replace(/\/\/\//g, '//').replace(oldStr, newStr)
    } else if (type == 'text') {
        element.text = {
            content: layer.property.content,
            mode: layer.property.textModel,//text|label
            properties: {
                fontSize: px2px(layer.property.size * layer.property.scaleX, 72, 300),
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
            drawBox: {
                x: 0,
                y: 0,
                width: 0,
                height: 0
            }
        }
    }

    return element;
}

function convert_resource_json(file_path, type) {
    
    let new_json = [];

    let urlSearch = '';
    let urlReplace = '';
    if (type == 'background') {
        urlSearch = 'com://\\' + global.style.style_path.replace(/\//g, '\\') + x10.background_folder + '\\';
        urlReplace = my.web_root + global.template_name + '/' + my.background_folder + '/';
    } else if (type == 'layout') {
        urlSearch = 'com://\\' + global.style.style_path.replace(/\//g, '\\') + x10.layout_folder + '\\';
        urlReplace = my.web_root + global.template_name + '/' + my.layout_folder + '/';
    } else if (type == 'decorate') {
        urlSearch = 'com://\\' + global.style.style_path.replace(/\//g, '\\') + x10.decorate_folder + '\\';
        urlReplace = my.web_root + global.template_name + '/' + my.decorate_folder + '/';
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

function create_empty_book(style) {
    return {
        id: 0,
        // template_id: 0,
        version: 1,
        author: '小凡',
        name: style.style_name,
        //规格尺寸id，相当于basebook表
        size_id: sizes['product_id_' + style.product_id],
        fascicule: 0,
        fascicule_type: 0,
        other_thickness: 0,
        // jackets: [],
        // covers: [],
        // inners_front: [],
        // inners: [],
        // inners_behind: [],
        // others: [],
        pages: [],
        // pagetypes: []
        show_page_num: 1,
        // craft: Object,
        // craft_id: 3,
        // crafts: Array(1),
        // paper: Object,
        // paper_id: 4
    };
}

function create_empty_page() {
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

if (process.argv0.length===2){
    console.log('请携带id参数')
} else{
    let id = parseInt(process.argv[2])
    switch (id) {
        case 1 : 
            main('愿得一人心', 'yuandeyirenxin', 1).catch(err => console.log(err));
            break;
        case 2 :
            main('10寸网球少女', 'wangqiushaonv', 2).catch(err => console.log(err));
            break;
        case 3 :
            main('盛夏光年', 'shengxiaguangnian', 3).catch(err => console.log(err));
            break;
        case 4 :
            main('甜蜜女孩', 'tianminvhai', 4).catch(err => console.log(err));
            break;
        case 5 :
            main('爱情进行时', 'aiqingjinxingshi', 5).catch(err => console.log(err));
            break;
        case 6 :
            main('如海绵', 'ruhaimian', 6).catch(err => console.log(err));
            break;
        case 7 :
            main('一朵年华', 'yiduonianhua', 7).catch(err => console.log(err));
            break;
        case 8 :
            main('诗意日常', 'shiyirichang', 8).catch(err => console.log(err));
            break;
        case 9 :
            main('梧叶枫黄', 'wuyefenghuang', 9).catch(err => console.log(err));
            break;
        case 10 :
            main('故事', 'gushi', 10).catch(err => console.log(err));
            break;
        case 11 :
            main('宁静的梦', 'ningjingdemeng', 11).catch(err => console.log(err));
            break;
        case 12 :
            main('寻觅', 'xunmi', 12).catch(err => console.log(err));
            break;
        case 13 :
            main('一夜璀璨', 'yiyecuican', 13).catch(err => console.log(err));
            break;
        default :
            console.log('解析id不存在')
            break;
    }
}
