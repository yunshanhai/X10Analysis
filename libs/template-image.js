const fs = require('fs');
const config = require('../config');
const styles = require('./styles')

// let id = parseInt(process.argv[2])

// if(styles.hasOwnProperty(id)) {
//     main(styles[id].name, styles[id].alias, styles[id].id).catch(err => console.log(err));
// }else {
//     console.log('解析id不存在')
// }

// async function main(style_name, template_name, id) {
//     let template_path = config.my.root + template_name + '/';
//     let background_folder = template_path + config.my.background_folder
//     let decorate_folder = template_path + config.my.decorate_folder

//     // l m t i
//     copyLostImage(background_folder)
//     copyLostImage(decorate_folder)
// }

exports.templateImageCheck = async (template_name) => {
    let template_path = config.my.root + template_name + '/';
    let background_folder = template_path + config.my.background_folder
    let decorate_folder = template_path + config.my.decorate_folder

    // l m t i
    copyLostImage(background_folder)
    copyLostImage(decorate_folder)
}

function copyLostImage (folder) {
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
