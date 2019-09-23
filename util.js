const fs = require('fs');

/**
 * 像素转毫米
 */
exports.px2mm = function (px, dpi = 96) {
    return px * 25.4 / dpi
}

/**
 * 毫米转像素
 */
exports.mm2px = function (mm, dpi = 96) {
    return mm / 25.4 * dpi
}

/**
 * 像素转像素
 */
exports.px2px = function (px, fromDpi = 300, toDpi = 96) {
    return px * toDpi / fromDpi
}

//删除传入的目录，目录下的文件及子目录
rmdir = function (path) {
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                rmdir(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

exports.rmdir = rmdir;


function copy(src, dst) {
    let paths = fs.readdirSync(src); //同步读取当前目录
    paths.forEach(function (path) {
        var _src = src + '/' + path;
        var _dst = dst + '/' + path;
        fs.stat(_src, function (err, stats) {  //stats  该对象 包含文件属性
            if (err) throw err;
            if (stats.isFile()) { //如果是个文件则拷贝 
                let readable = fs.createReadStream(_src);//创建读取流
                let writable = fs.createWriteStream(_dst);//创建写入流
                readable.pipe(writable);
            } else if (stats.isDirectory()) { //是目录则 递归 
                copydir(_src, _dst, copy);
            }
        });
    });
}

var copydir = function (src, dst) {
    fs.access(dst, fs.constants.F_OK, (err) => {
        if (err) {
            fs.mkdirSync(dst);
        }
        copy(src, dst);
    });
};

//异步拷贝文件夹
exports.copydir = copydir;

function copySync(src, dst) {
    let paths = fs.readdirSync(src); //同步读取当前目录
    paths.forEach(function (path) {
        var _src = src + '/' + path;
        var _dst = dst + '/' + path;
        let stats = fs.statSync(_src);
        if (stats.isFile()) { //如果是个文件则拷贝 
            fs.writeFileSync(_dst, fs.readFileSync(_src));
        } else if (stats.isDirectory()) { //是目录则 递归 
            copydirSync(_src, _dst);
        }
    });
}

var copydirSync = function (src, dst) {
    try{
        fs.accessSync(dst, fs.constants.F_OK);
    }catch(err){
        fs.mkdirSync(dst);
    }
    copySync(src, dst);
};

exports.copydirSync = copydirSync;