// import {sqlite} from 'sqlite';
const sqlite = require('sqlite');
const fs = require('fs');
const sizes = require('./sizes');
const config = require('./config');
const util = require('./util');
const mysql_query = require('./mysql_query');
const styles = require('./libs/styles')
const template_helper = require('./libs/template-helper')
const template_image = require('./libs/template-image')

//如果查询到多个同名模板名称，需要设置index对应的行索引，并且设置multi_row=true;
//style_name:x10模板的中文名，template_name:转化为我们的模板的文件夹名，id：模板的id
//使用模板的中文名查询到多条记录，需要将multi_row设置为true再转换，并且设置要转换哪条数据，使用索引index指定
async function main(style_name, template_name, id, op = null, mine = false, multi_row = false, index = 0) {
    const db = await sqlite.open(config.x10.db);
    let style = null;

    if (mine) {
        // x10个人模板
        const rows = await db.all(`select * from xc_mine_template_style 
            where style_name=?`, style_name);
        
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
        style = rows[index];

    } else {
        // x10 官方模板
        const rows = await db.all(`select a.*,b.* from xc_product_style a 
            left join xc_product b on a.product_id = b.product_id 
            where a.style_name=?`, style_name);
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
        style = rows[index];
    }

    let style_dir = config.x10.resource + style.style_path;
    if (!fs.existsSync(style_dir)) {
        console.log('路径不存在：' + style_dir);
        return;
    }

    let size_id = await getSizeId(mine ? 0 : parseInt(style.product_id), style.width, style.height, style.compose_type == 2 ? 1 : 0)
    //将模板数据插入tbl_alb_template表
    if (op === 'a') {
        let rows = await mysql_query('select id from tbl_alb_template where id = ? ', id);
        if(rows.length==0) {
            let type = style.product_type == 2 ? 'calendar' : 'album';
            let path = config.my.web_root + template_name + '/';

            let params = {
                id: id,
                size_id,
                name: style_name,
                version: 1,
                type: type,
                description: '',
                thumb_url: '', 
                path: path, 
                page_count: style.page,
                photo_count: mine ? 0 : style.filling_photo_count,
                hot_num: 0,
                is_top: 0,
                state: 1,
                sort: id
            }
            add_alb_template(params)
        }
    }

    //模板文件路径
    let template_path = config.my.root + template_name + '/';

    // 处理模板资源相关路径
    if (op === 'a') {
        if (fs.existsSync(template_path)) {
            console.log('移除原模板文件夹：' + template_path);
            util.rmdir(template_path);
        }
    
        console.log('创建模板文件夹：' + template_path);
        fs.mkdirSync(template_path);
        
        if(fs.existsSync(style_dir + config.x10.layout_folder)){
            console.log('拷贝布局文件');
            util.copydirSync(style_dir + config.x10.layout_folder, template_path + config.my.layout_folder);
        }
        
        if(fs.existsSync(style_dir + config.x10.background_folder)) {
            console.log('拷贝背景文件');
            util.copydirSync(style_dir + config.x10.background_folder, template_path + config.my.background_folder);
        }

        if(fs.existsSync(style_dir + config.x10.decorate_folder)) {
            console.log('拷贝装饰文件');
            util.copydirSync(style_dir + config.x10.decorate_folder, template_path + config.my.decorate_folder);
        }

        if(fs.existsSync(style_dir + config.x10.mask_folder)) {
            console.log('拷贝蒙版文件');
            util.copydirSync(style_dir + config.x10.mask_folder, template_path + config.my.mask_folder);
        }

        if(fs.existsSync(style_dir + config.x10.cover_folder)) {
            console.log('拷贝封面文件');
            util.copydirSync(style_dir + config.x10.cover_folder, template_path + config.my.cover_folder);
        }

        console.log('处理模板缺少的缩略图（背景、装饰）');
        template_image.templateImageCheck(template_name)
    }
    
    if (op == null || op === 'a') {
        console.log('转化布局文件:' + config.x10.layout_file);
        let new_json = template_helper.convert_resource_json(style_dir + config.x10.layout_file, 'layout', style.style_path, template_name);
        console.log('转化布局里每一个布局文件');
        let layouts = [];
        for (let i = 0; i < new_json.length; i++) {
            let layout_json = convert_layout_json('.' + new_json[i], i, style.style_path, template_name);
            layouts.push(layout_json);
        }
        fs.writeFileSync(template_path + config.my.layout_file, JSON.stringify(layouts));

        console.log('转化模板文件：' + config.x10.template_file);
        new_json = await convert_style_json(style_dir + config.x10.template_file, style, template_name, size_id);
        fs.writeFileSync(template_path + config.my.template_file, JSON.stringify(new_json));

        if (op == null) {
            console.log('将文件复制到站点服务目录' + template_name)
            fs.copyFileSync(template_path + config.my.layout_file, config.my.www_root + template_name + '/' + config.my.layout_file)
            fs.copyFileSync(template_path + config.my.template_file, config.my.www_root + template_name + '/' + config.my.template_file)
        }
    }

    if (op === 'a') {
        console.log('转化背景文件:' + config.x10.background_file);
        new_json = template_helper.convert_resource_json(style_dir + config.x10.background_file, 'background', style.style_path, template_name);
        fs.writeFileSync(template_path + config.my.background_file, JSON.stringify(new_json));

        console.log('转化装饰文件:' + config.x10.decorate_file);
        new_json = template_helper.convert_resource_json(style_dir + config.x10.decorate_file, 'decorate', style.style_path, template_name);
        fs.writeFileSync(template_path + config.my.decorate_file, JSON.stringify(new_json));
    }

    if (op === 'a') {
        console.log('将整个模板目录复制到站点服务目录' + template_name)
        let www_path = config.my.www_root + template_name + '/'
        if (fs.existsSync(www_path)) {
            console.log('站点模板文件夹已存在，移除原文件夹：' + www_path);
            util.rmdir(www_path);
        }
        console.log('开始拷贝')
        util.copydirSync(template_path, www_path)
    }

    console.log('解析结束');
}

async function getSizeId (product_id, width, height, is_cross) {
    if (product_id > 0) {
        return sizes['product_id_' + style.product_id]
    } else {
        let sql = `select id from tbl_alb_template_size where width=? and height=? and is_cross=?`
        let rows = await mysql_query(sql, [width, height, is_cross])
        // console.log('----------')
        // console.log(rows[0].id);return;
        if(rows.length > 0) {
            return rows[0].id
        } else {
            rows = await mysql_query('select max(id) as id from tbl_alb_template_size');
            let new_id = rows[0].id + 1;
            sql = `insert into tbl_alb_template_size
            (id,name,description,width,height,is_cross,state,sort) 
            values(?,?,?,?,?,?,?,?)`;
            let name = '个人 ' + (is_cross == 1 ? '跨页 ' : '不跨页 ') + util.px2mm(width, 300).toFixed() + '*' + util.px2mm(height, 300).toFixed()
            rows = await mysql_query(sql, [
                new_id,
                name,
                name,
                width,
                height,
                is_cross,
                1,
                new_id
            ])
            return new_id
        }
    }
    
}

async function add_alb_template (params) {
    let sql = `insert into tbl_alb_template 
        (id,size_id,name,version,type,description,thumb_url,path,page_count,photo_count,hot_num,is_top,state,sort)
        values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    let rows = await mysql_query(sql, [
        params.id,
        params.size_id,
        params.name,
        params.version,
        params.type,
        params.description,
        params.thumb_url, 
        params.path, 
        params.page_count,
        params.photo_count,
        params.hot_num,
        params.is_top,
        params.state,
        params.sort
    ])
    return rows
}

async function convert_style_json(file_path, style, template_name, size_id) {
    let json = JSON.parse(fs.readFileSync(file_path).toString());
    let new_json = template_helper.create_empty_book(style.style_name, size_id)

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
        let page = convert_page(outer_page, 'cover', style.style_path, template_name);
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
            let myBleed = util.mm2px(config.my.bleed, 300)
            for(let i = 0; i< cover_page.elements.length; i++) {
                let element = cover_page.elements[i]
                if (element.x > halfWidth) {
                    element.position = 'cover'
                    element.x -= halfWidth
                    element.x -= cover_page.cover.spine * 2
                } else {
                    element.position = 'back'
                }
                element.x -= cover_page.cover.bleed
                element.y -= cover_page.cover.bleed

                element.x += myBleed
                element.y += myBleed
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

        delete cover_page.cover

        new_json.pages.push(cover_page)
    }

    //----------------------------------------内页---------------------------------------
    console.log('解析模板文件的内页');
    let inner_pages = json.template.style.album.inner_pages.page;
    for (let i = 0; i < inner_pages.length; i++) {
        let inner_page = inner_pages[i];
        let page = convert_page(inner_page, 'inner', style.style_path, template_name);
        page.sort = i;
        page.id = pageCount;
        new_json.pages.push(page);

        pageCount++;
    }

    return new_json;
}

function convert_layout_json(layout_file, index, style_path, template_name) {
    let page_type = layout_file.indexOf('cover.json') > -1 ? 'cover' : 'inner';
    //传入的是转化后新模板布局layout.json中的项，需转化为x10里的路径
    let page_json = JSON.parse(fs.readFileSync(layout_file).toString());
    let page = convert_page(page_json, page_type, style_path, template_name);
    page.id = index
    page.sort = index
    return page;
}

function convert_page(x10_page, page_type, style_path, template_name) {
    let page = template_helper.create_empty_page();
    page.type = page_type;
    page.position = page_type
    //背景图层
    let urlSearch = 'com://' + style_path + config.x10.background_folder;
    let urlReplace = config.my.web_root + template_name + '/' + config.my.background_folder;
    if(x10_page.hasOwnProperty('background')){
        page.background.image = x10_page.background.background_layer.image.property.url
        page.background.image = page.background.image.replace(/\\/g, '/')
        page.background.image = page.background.image.replace(/\/\/\//g, '//')
        page.background.image = page.background.image.replace(urlSearch, urlReplace);
    } else {
        page.background.image = null
    }
    
    /* 元素的转换兼容，x10模板有些元素当单个时，会把数组存成对象 */

    //装饰
    if (Array.isArray(x10_page.contents.decorate_layer)){
        for (let i in x10_page.contents.decorate_layer) {
            let layer = x10_page.contents.decorate_layer[i];
            let element = template_helper.convert_element(layer, 'decorate', x10_page.location.refwidth, style_path, template_name);
            page.elements.push(element);
        }
    } else {
        let layer = x10_page.contents.decorate_layer;
        let element = template_helper.convert_element(layer, 'decorate', x10_page.location.refwidth, style_path, template_name);
        page.elements.push(element);
    }
    
    //照片
    if(Array.isArray(x10_page.contents.photo_layer)){
        for (let i in x10_page.contents.photo_layer) {
            let layer = x10_page.contents.photo_layer[i];
            let element = template_helper.convert_element(layer, 'photo', x10_page.location.refwidth, style_path, template_name);
            page.elements.push(element);
        }
    } else {
        let layer = x10_page.contents.photo_layer;
        let element = template_helper.convert_element(layer, 'photo', x10_page.location.refwidth, style_path, template_name);
        page.elements.push(element);
    }
    

    //文字
    if (x10_page.contents.hasOwnProperty('text_layer')){
        if(Array.isArray(x10_page.contents.text_layer)){
            for (let i in x10_page.contents.text_layer) {
                let layer = x10_page.contents.text_layer[i];
                let element = template_helper.convert_element(layer, 'text', x10_page.location.refwidth, style_path, template_name);
                page.elements.push(element);
            }
        } else {
            let layer = x10_page.contents.text_layer;
            let element = template_helper.convert_element(layer, 'text', x10_page.location.refwidth, style_path, template_name);
            page.elements.push(element);
        }
    }

    if (page.type == 'cover') {
        let cover = {}
        cover.bleed = parseInt(x10_page.property.top_bleed)
        cover.spine = x10_page.contents.hasOwnProperty('spin_layer') ? x10_page.contents.spin_layer.refwidth : 142
        page.cover = cover
    }

    page.elements.sort((a, b) => a.index - b.index);

    // 重新设置index，index从0开始
    for(let i = 0; i < page.elements.length; i++) {
        delete page.elements[i].index
    }

    return page;
}

// node index.js id op 第一个参数是id，0代表所有，
// 第二个参数是具体操作，默认只解析模板和布局文件
// 当为a时，执行所有操作，当为c时拷贝模板的文件到网站工作目录
if (process.argv.length===2){
    let msg = '请携带id参数';
    msg += '\n\tid参数等于0时处理全部模板，大于0时处理指定模板';
    console.log(msg)
    return
}

// 解析的模板id，0为全部
let id = parseInt(process.argv[2])
// 操作，默认只解析模板，a为执行所有操作
let op = process.argv.length > 3 ? process.argv[3] : null
if (id === 0) {
    if (op === 'a') {
        console.log('全部模板不能执行a操作，只能单独对某个模板执行a操作')
        return
    }

    let ids = Object.keys(styles)
    ids.forEach(item => {
        let style = styles[item];
        main(style.name, style.alias, style.id, op, style.mine).catch(err => console.log(err))
    });
} else if(styles.hasOwnProperty(id)) {
    let style = styles[id];
    main(style.name, style.alias, style.id, op, style.mine).catch(err => console.log(err))
}else {
    console.log('解析id不存在')
}
