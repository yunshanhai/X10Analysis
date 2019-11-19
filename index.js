// import {sqlite} from 'sqlite';
const sqlite = require('sqlite');
const fs = require('fs');
const sizes = require('./sizes');
const config = require('./config');
const util = require('./util');
const mysql_query = require('./mysql_query');
const styles = require('./libs/styles')
const template_helper = require('./libs/template-helper')

//如果查询到多个同名模板名称，需要设置index对应的行索引，并且设置multi_row=true;
//style_name:x10模板的中文名，template_name:转化为我们的模板的文件夹名，id：模板的id
//使用模板的中文名查询到多条记录，需要将multi_row设置为true再转换，并且设置要转换哪条数据，使用索引index指定
async function main(style_name, template_name, id, multi_row = false, index = 0) {
    const db = await sqlite.open(config.x10.db);
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

    let style_dir = config.x10.resource + style.style_path;
    if (!fs.existsSync(style_dir)) {
        console.log('路径不存在：' + style_dir);
        return;
    }

    //创建模板文件夹
    let template_path = config.my.root + template_name + '/';

    if (fs.existsSync(template_path)) {
        console.log('模板文件夹已存在，移除原文件夹：' + template_path);
        util.rmdir(template_path);
    }

    console.log('创建模板文件夹：' + template_path);
    fs.mkdirSync(template_path);

    console.log('创建布局文件夹');
    fs.mkdirSync(template_path + config.my.layout_folder);
    console.log('拷贝布局文件夹');
    util.copydirSync(style_dir + config.x10.layout_folder, template_path + config.my.layout_folder);
    console.log('转化布局文件:' + config.x10.layout_file);
    let new_json = template_helper.convert_resource_json(style_dir + config.x10.layout_file, 'layout', style.style_path, template_name);
    // fs.writeFileSync(template_path + config.my.layout_file, JSON.stringify(new_json));
    console.log('转化布局里每一个布局文件');
    let layouts = [];
    for (let i = 0; i < new_json.length; i++) {
        let layout_json = convert_layout_json('.' + new_json[i], i, style.style_path, template_name);
        layouts.push(layout_json);
        // fs.writeFileSync('.' + new_json[i], JSON.stringify(layout_json));
    }
    fs.writeFileSync(template_path + config.my.layout_file, JSON.stringify(layouts));

    console.log('转化背景文件:' + config.x10.background_file);
    new_json = template_helper.convert_resource_json(style_dir + config.x10.background_file, 'background', style.style_path, template_name);
    fs.writeFileSync(template_path + config.my.background_file, JSON.stringify(new_json));
    console.log('拷贝背景文件夹');
    if(fs.existsSync(style_dir + config.x10.background_folder)) {
        util.copydir(style_dir + config.x10.background_folder, template_path + config.my.background_folder);
    }else{
        console.log('背景文件夹不存在');
    }
    

    console.log('转化装饰文件:' + config.x10.decorate_file);
    new_json = template_helper.convert_resource_json(style_dir + config.x10.decorate_file, 'decorate', style.style_path, template_name);
    fs.writeFileSync(template_path + config.my.decorate_file, JSON.stringify(new_json));
    console.log('拷贝装饰文件夹');
    if(fs.existsSync(style_dir + config.x10.decorate_folder)) {
        util.copydir(style_dir + config.x10.decorate_folder, template_path + config.my.decorate_folder);
    }else{
        console.log('装饰文件夹不存在');
    }

    console.log('转化模板文件：' + config.x10.template_file);
    new_json = await convert_style_json(style_dir + config.x10.template_file, style, template_name);
    fs.writeFileSync(template_path + config.my.template_file, JSON.stringify(new_json));

    console.log('解析结束');
}

async function convert_style_json(file_path, style, template_name) {
    let json = JSON.parse(fs.readFileSync(file_path).toString());
    let new_json = template_helper.create_empty_book(style.style_name, sizes['product_id_' + style.product_id])

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
    

    //装饰
    for (let i in x10_page.contents.decorate_layer) {
        let layer = x10_page.contents.decorate_layer[i];
        let element = template_helper.convert_element(layer, 'decorate', x10_page.location.refwidth);
        page.elements.push(element);
    }

    //照片
    for (let i in x10_page.contents.photo_layer) {
        let layer = x10_page.contents.photo_layer[i];
        let element = template_helper.convert_element(layer, 'photo', x10_page.location.refwidth);
        page.elements.push(element);
    }

    //文字
    for (let i in x10_page.contents.text_layer) {
        let layer = x10_page.contents.text_layer[i];
        let element = template_helper.convert_element(layer, 'text', x10_page.location.refwidth);
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

if (process.argv0.length===2){
    console.log('请携带id参数')
} else{
    let id = parseInt(process.argv[2])
    if(styles.hasOwnProperty(id)) {
        main(styles[id].name, styles[id].alias, styles[id].id).catch(err => console.log(err));
    }else {
        console.log('解析id不存在')
    }
}
