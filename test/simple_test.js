"use strict";

var JSZip = require("../lib/index");
var fs = require("fs");
var path = require("path");

// 测试：压缩一个文件
function testCompress() {
    console.log("=== 测试压缩 ===");
    var zip = new JSZip();
    
    // 添加一个文本文件
    zip.file("hello.txt", "Hello World!\n这是测试内容");
    zip.file("folder/nested.txt", "嵌套文件内容");
    
    // 生成 zip 文件
    return zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE"
    }).then(function(content) {
        // 保存到文件
        var outputPath = path.join(__dirname, "output", "test.zip");
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content);
        console.log("✓ 压缩成功，文件保存到:", outputPath);
        return content;
    });
}

// 测试：解压文件
function testDecompress(zipBuffer) {
    console.log("\n=== 测试解压 ===");
    return JSZip.loadAsync(zipBuffer).then(function(zip) {
        console.log("✓ ZIP 文件加载成功");
        console.log("文件列表:");
        
        zip.forEach(function(relativePath, file) {
            console.log("  -", relativePath, file.dir ? "(目录)" : "");
        });
        
        // 读取第一个文件内容
        return zip.file("hello.txt").async("string");
    }).then(function(content) {
        console.log("\n✓ 读取文件内容成功:");
        console.log(content);
    });
}

// 运行测试
console.log("开始测试 JSZip 压缩和解压功能...\n");

testCompress()
    .then(function(zipBuffer) {
        return testDecompress(zipBuffer);
    })
    .then(function() {
        console.log("\n=== 测试完成 ===");
    })
    .catch(function(err) {
        console.error("测试失败:", err);
        process.exit(1);
    });