"use strict";

/**
 * Test: Decryption functionality (Phase 2)
 * This tests the integrated decryption with JSZip
 */

var JSZip = require("../lib/index");
var fs = require("fs");
var path = require("path");

console.log("=== JSZip 解密功能测试 (Phase 2) ===\n");

// Test 1: 测试 test/ref/encrypted.zip
console.log("【测试 1】解压真实的加密 ZIP 文件");
console.log("文件: test/ref/encrypted.zip");

var encryptedZipPath = path.join(__dirname, "ref", "encrypted.zip");

if (!fs.existsSync(encryptedZipPath)) {
    console.log("✗ 测试文件不存在:", encryptedZipPath);
    console.log("跳过测试 1\n");
} else {
    var encryptedData = fs.readFileSync(encryptedZipPath);
    console.log("✓ 文件读取成功，大小:", encryptedData.length, "字节");

    // 根据 test/asserts/load.js 中的注释，这个文件使用 zip -0 -X -e encrypted.zip Hello.txt 创建
    // 需要知道密码...让我们先尝试常见密码
    var testPasswords = ["password", "test", "hello", "123456", ""];

    console.log("尝试解密（测试常见密码）...");

    var tested = false;
    testPasswords.forEach(function(pwd) {
        if (tested) return;
        
        try {
            JSZip.loadAsync(encryptedData, {
                password: pwd || undefined
            }).then(function(zip) {
                console.log("✓ 成功使用密码:", pwd || "(无密码)");
                console.log("文件列表:");
                zip.forEach(function(relativePath, file) {
                    console.log("  -", relativePath);
                });
                tested = true;
                
                // 尝试读取内容
                var files = Object.keys(zip.files);
                if (files.length > 0) {
                    return zip.file(files[0]).async("string");
                }
            }).then(function(content) {
                if (content) {
                    console.log("文件内容:", content.substring(0, 100));
                }
            }).catch(function(err) {
                // 密码错误或其他错误
                if (err.message.indexOf("password") === -1) {
                    console.log("密码", pwd || "(无密码)", "失败:", err.message);
                }
            });
        } catch (err) {
            console.log("密码", pwd || "(无密码)", "失败:", err.message);
        }
    });

    if (!tested) {
        console.log("✗ 所有测试密码均失败");
        console.log("注意：此测试需要知道 encrypted.zip 的正确密码\n");
    }
}

// Test 2: 创建并解压加密文件（完整流程测试）
console.log("\n【测试 2】完整加密解密流程（使用 Phase 1 模块）");

var TraditionalEncryption = require("../lib/encryption/traditional");
var encryptionUtils = require("../lib/encryption/utils");

// 创建测试数据
var testPassword = "testPassword123";
var testContent = "This is a secret message for testing!";
var testData = encryptionUtils.stringToBytes(testContent);
var testCrc = encryptionUtils.calculateCRC32(testData);

console.log("原始内容:", testContent);
console.log("密码:", testPassword);

// 加密数据
var cipher = new TraditionalEncryption(testPassword);
var encryptedData = cipher.encrypt(testData, testCrc, Date.now());

console.log("✓ 数据加密成功，长度:", encryptedData.length);

// 解密数据
var decipher = new TraditionalEncryption(testPassword);
var decryptResult = decipher.decrypt(encryptedData, testCrc, Date.now());

if (decryptResult.valid) {
    console.log("✓ 解密成功");
    var decryptedText = String.fromCharCode.apply(null, decryptResult.data);
    if (decryptedText === testContent) {
        console.log("✓ 内容验证通过");
    } else {
        console.log("✗ 内容不匹配");
        console.log("期望:", testContent);
        console.log("实际:", decryptedText);
    }
} else {
    console.log("✗ 解密失败");
}

// Test 3: 测试错误密码处理
console.log("\n【测试 3】错误密码处理");

var wrongDecipher = new TraditionalEncryption("wrongPassword");
var wrongResult = wrongDecipher.decrypt(encryptedData, testCrc, Date.now());

if (!wrongResult.valid) {
    console.log("✓ 正确识别错误密码");
} else {
    console.log("✗ 未能识别错误密码");
}

// Test 4: 测试无密码解压加密文件
console.log("\n【测试 4】无密码尝试解压加密文件");

// 这个测试需要实际的加密 ZIP 文件结构
// 由于我们还没有实现压缩功能，这里只能做概念性测试

console.log("注意：完整的 ZIP 格式测试需要等待 Phase 3（压缩功能）完成");

console.log("\n=== Phase 2 测试总结 ===");
console.log("\n已完成修改:");
console.log("  ✓ lib/zipEntry.js - 移除加密异常，存储加密信息");
console.log("  ✓ lib/compressedObject.js - 集成 DecryptWorker");
console.log("  ✓ lib/load.js - 添加 password 选项");
console.log("  ✓ lib/zipObject.js - 支持文件级密码");

console.log("\nAPI 使用方式:");
console.log("  JSZip.loadAsync(encryptedZipData, {");
console.log("      password: \"yourPassword\"");
console.log("  }).then(zip => {");
console.log("      return zip.file(\"secret.txt\").async(\"string\");");
console.log("  });");

console.log("\n下一步 (Phase 3): 实现压缩功能");

