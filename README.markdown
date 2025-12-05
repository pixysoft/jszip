JSZip
=====

A library for creating, reading and editing .zip files with JavaScript, with a
lovely and simple API.

See https://stuk.github.io/jszip for all the documentation.

## 密码保护功能

### 解压带密码的 ZIP 文件

```javascript
// 加载加密的 ZIP 文件
JSZip.loadAsync(encryptedZipData, {
    password: "yourPassword"
}).then(function(zip) {
    // 读取文件内容
    return zip.file("secret.txt").async("string");
}).then(function(content) {
    console.log(content);
});
```

### 创建带密码的 ZIP 文件

```javascript
const zip = new JSZip();
zip.file("secret.txt", "机密内容");
zip.file("data.json", JSON.stringify({key: "value"}));

// 生成加密的 ZIP 文件
zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    password: "yourPassword",
    encryptionMethod: "traditional"
}).then(function(content) {
    // 保存加密的 ZIP 文件
    saveAs(content, "encrypted.zip");
});
```

**注意**：当前支持 ZIP 2.0 传统加密（PKWARE），适用于基础数据保护。如需更高安全性，请使用其他加密工具。

## 基础使用示例

```javascript
const zip = new JSZip();

zip.file("Hello.txt", "Hello World\n");

const img = zip.folder("images");
img.file("smile.gif", imgData, {base64: true});

zip.generateAsync({type:"blob"}).then(function(content) {
    // see FileSaver.js
    saveAs(content, "example.zip");
});

/*
Results in a zip containing
Hello.txt
images/
    smile.gif
*/
```
License
-------

JSZip is dual-licensed. You may use it under the MIT license *or* the GPLv3
license. See [LICENSE.markdown](LICENSE.markdown).
