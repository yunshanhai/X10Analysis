const fs = require('fs');
const config = require('./config');

//转化后相关
const my = config.my;

const global = {
    template_name: '',
    style: null
}

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

async function main(style_name, template_name, id) {
    let template_path = my.root + template_name + '/';
    let background_folder = template_path + my.background_folder
    let decorate_folder = template_path + my.decorate_folder

    // l m t i
    deal(background_folder)
    deal(decorate_folder)
}

function deal (folder) {
    if(fs.existsSync(folder)){
        let allFiles = fs.readdirSync(folder); //同步读取当前目录
        let mainFiles = allFiles.filter(item => item.indexOf('_') === -1)

        mainFiles.forEach(function (path) {
            let copyFile = path

            let currentFile = path.replace('.', '_l.')
            copyFile = copy(folder, currentFile, copyFile)

            currentFile = path.replace('.', '_m.')
            copyFile = copy(folder, currentFile, copyFile)

            currentFile = path.replace('.', '_t.')
            copyFile = copy(folder, currentFile, copyFile)

            currentFile = path.replace('.', '_i.')
            copyFile = copy(folder, currentFile, copyFile)
        })
    } else {
        console.log('不存在的目录：' + folder)
    }
    
}

function copy (folder, currentFile, copyFile) {
    if (fs.existsSync(folder + '/' + currentFile)){
        copyFile = currentFile
    } else {
        console.log('不存在：' + currentFile)
        fs.writeFileSync(folder + '/' + currentFile, fs.readFileSync(folder + '/' + copyFile));
    }

    return copyFile
}
