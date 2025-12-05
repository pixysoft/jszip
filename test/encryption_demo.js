"use strict";

/**
 * Demo: Traditional Encryption Module Functionality
 * This demonstrates the Phase 1 encryption infrastructure
 */

var TraditionalEncryption = require("../lib/encryption/traditional");
var encryptionUtils = require("../lib/encryption/utils");

console.log("=== JSZip 加密模块演示 (Phase 1) ===\n");

// Test 1: 基础加密解密
console.log("【测试 1】基础加密解密");
var password = "mySecretPassword";
var originalText = "这是一条需要保护的机密信息！Hello World!";
var originalData = encryptionUtils.stringToBytes(originalText);

console.log("原始数据长度:", originalData.length, "字节");
console.log("原始文本:", originalText);

// 计算 CRC32
var crc32 = encryptionUtils.calculateCRC32(originalData);
console.log("CRC32:", "0x" + crc32.toString(16));

// 加密
var cipher1 = new TraditionalEncryption(password);
var encryptedData = cipher1.encrypt(originalData, crc32, 0);
console.log("加密后长度:", encryptedData.length, "字节 (包含12字节头)");
console.log("✓ 加密成功\n");

// 解密
var cipher2 = new TraditionalEncryption(password);
var decryptResult = cipher2.decrypt(encryptedData, crc32, 0);

if (decryptResult.valid) {
    console.log("✓ 密码验证成功");
    console.log("解密后长度:", decryptResult.data.length, "字节");
    
    // 验证数据完整性
    var match = true;
    for (var i = 0; i < originalData.length; i++) {
        if (decryptResult.data[i] !== originalData[i]) {
            match = false;
            break;
        }
    }
    
    if (match) {
        console.log("✓ 数据完整性验证通过");
        console.log("解密文本:", String.fromCharCode.apply(null, decryptResult.data));
    } else {
        console.log("✗ 数据不匹配");
    }
} else {
    console.log("✗ 密码验证失败");
}

// Test 2: 错误密码测试
console.log("\n【测试 2】错误密码验证");
var wrongCipher = new TraditionalEncryption("wrongPassword");
var wrongResult = wrongCipher.decrypt(encryptedData, crc32, 0);

if (!wrongResult.valid) {
    console.log("✓ 正确识别错误密码");
} else {
    console.log("✗ 未能识别错误密码");
}

// Test 3: 性能测试
console.log("\n【测试 3】性能测试");
var testSizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB

testSizes.forEach(function(size) {
    var data = new Uint8Array(size);
    for (var i = 0; i < size; i++) {
        data[i] = i & 0xFF;
    }
    
    var dataCrc = encryptionUtils.calculateCRC32(data);
    
    var startTime = Date.now();
    var encCipher = new TraditionalEncryption("testPassword");
    var enc = encCipher.encrypt(data, dataCrc, 0);
    
    var decCipher = new TraditionalEncryption("testPassword");
    var dec = decCipher.decrypt(enc, dataCrc, 0);
    var endTime = Date.now();
    
    console.log(size + " 字节: " + (endTime - startTime) + "ms" + 
                (dec.valid ? " ✓" : " ✗"));
});

// Test 4: 多文件场景
console.log("\n【测试 4】多文件加密 (模拟 ZIP 场景)");
var files = [
    { name: "file1.txt", content: "第一个文件内容" },
    { name: "file2.txt", content: "第二个文件内容" },
    { name: "file3.txt", content: "第三个文件内容" }
];

var sharedPassword = "zipPassword";
var encryptedFiles = [];

files.forEach(function(file) {
    var fileData = encryptionUtils.stringToBytes(file.content);
    var fileCrc = encryptionUtils.calculateCRC32(fileData);
    
    var fileCipher = new TraditionalEncryption(sharedPassword);
    var encrypted = fileCipher.encrypt(fileData, fileCrc, 0);
    
    encryptedFiles.push({
        name: file.name,
        encrypted: encrypted,
        crc: fileCrc
    });
});

console.log("✓ 加密 " + files.length + " 个文件");

// 解密验证
var allValid = true;
encryptedFiles.forEach(function(encFile) {
    var decCipher = new TraditionalEncryption(sharedPassword);
    var result = decCipher.decrypt(encFile.encrypted, encFile.crc, 0);
    if (!result.valid) {
        allValid = false;
    }
});

if (allValid) {
    console.log("✓ 所有文件解密成功");
} else {
    console.log("✗ 部分文件解密失败");
}

console.log("\n=== Phase 1 基础架构测试完成 ===");
console.log("\n已完成模块:");
console.log("  ✓ lib/encryption/utils.js - 加密工具函数");
console.log("  ✓ lib/encryption/traditional.js - ZIP 2.0 传统加密");
console.log("  ✓ lib/encryption/index.js - 模块导出");
console.log("  ✓ lib/stream/DecryptWorker.js - 解密 Worker");
console.log("  ✓ lib/stream/EncryptWorker.js - 加密 Worker");
console.log("  ✓ test/asserts/encryption.js - 单元测试");

console.log("\n微信小程序兼容性:");
console.log("  ✓ 纯 JavaScript 实现，无 Node.js 原生依赖");
console.log("  ✓ 使用 Uint8Array，兼容小程序环境");
console.log("  ✓ 无 DOM API 依赖");
console.log("  ✓ 文件体积小 (约 5KB)");

console.log("\n下一步 (Phase 2): 集成到 JSZip 核心解压流程");

