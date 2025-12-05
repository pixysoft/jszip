"use strict";

/**
 * Compatibility Test: JSZip <-> Standard ZIP Tools
 * 
 * Tests:
 * 1. zip command -> JSZip decrypt
 * 2. JSZip encrypt -> unzip command
 * 3. JSZip encrypt -> JSZip decrypt (baseline)
 */

var JSZip = require("../lib/index");
var fs = require("fs");
var path = require("path");
var execSync = require("child_process").execSync;

console.log("=== ZIP 工具兼容性测试 ===\n");

var testDir = __dirname;
var testPassword = "testPass123";
var testContent1 = "Hello World! This is a test file.";
var testContent2 = JSON.stringify({ test: "data", number: 42 });

// Test counters
var testsPassed = 0;
var testsFailed = 0;

function reportTest(name, passed, message) {
    if (passed) {
        console.log("✓ " + name);
        testsPassed++;
    } else {
        console.log("✗ " + name);
        if (message) {
            console.log("  错误: " + message);
        }
        testsFailed++;
    }
}

function cleanup() {
    var files = [
        path.join(testDir, "test_cmd_encrypted.zip"),
        path.join(testDir, "test_jszip_encrypted.zip"),
        path.join(testDir, "test_file1.txt"),
        path.join(testDir, "test_file2.json"),
        path.join(testDir, "extracted_test"),
        path.join(testDir, "extracted_cmd"),
        path.join(testDir, "extracted_jszip")
    ];
    
    files.forEach(function(file) {
        try {
            if (fs.existsSync(file)) {
                if (fs.statSync(file).isDirectory()) {
                    fs.rmSync(file, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(file);
                }
            }
        } catch (e) {
            // ignore
        }
    });
}

// Clean up before tests
cleanup();

console.log("【准备测试】创建测试文件...\n");

// Create test files
var testFile1 = path.join(testDir, "test_file1.txt");
var testFile2 = path.join(testDir, "test_file2.json");
fs.writeFileSync(testFile1, testContent1);
fs.writeFileSync(testFile2, testContent2);
console.log("✓ 测试文件已创建\n");

// ============================================================
// Test 1: zip command -> JSZip decrypt
// ============================================================
console.log("【测试 1】使用 zip 命令加密 -> JSZip 解密\n");

var cmdZipPath = path.join(testDir, "test_cmd_encrypted.zip");

try {
    // Create encrypted ZIP using zip command
    console.log("步骤 1.1: 使用 zip 命令创建加密文件...");
    execSync('cd "' + testDir + '" && zip -P "' + testPassword + '" test_cmd_encrypted.zip test_file1.txt test_file2.json', {
        stdio: 'pipe'
    });
    console.log("✓ zip 命令执行成功\n");
    
    // Try to decrypt with JSZip
    console.log("步骤 1.2: 使用 JSZip 解密...");
    var cmdZipData = fs.readFileSync(cmdZipPath);
    
    JSZip.loadAsync(cmdZipData, { password: testPassword })
        .then(function(zip) {
            console.log("✓ JSZip 加载成功");
            
            // Read files
            return Promise.all([
                zip.file("test_file1.txt").async("string"),
                zip.file("test_file2.json").async("string")
            ]);
        })
        .then(function(results) {
            var content1 = results[0];
            var content2 = results[1];
            
            var test1Pass = (content1 === testContent1);
            var test2Pass = (content2 === testContent2);
            
            reportTest("测试 1.1: zip命令加密 -> JSZip解密 (文件1)", test1Pass, 
                test1Pass ? null : "内容不匹配");
            reportTest("测试 1.2: zip命令加密 -> JSZip解密 (文件2)", test2Pass,
                test2Pass ? null : "内容不匹配");
            
            console.log("");
            return runTest2();
        })
        .catch(function(err) {
            reportTest("测试 1: zip命令加密 -> JSZip解密", false, err.message);
            console.log("错误详情:", err.stack);
            console.log("");
            return runTest2();
        });
        
} catch (err) {
    reportTest("测试 1: zip命令创建", false, err.message);
    console.log("");
    runTest2();
}

// ============================================================
// Test 2: JSZip encrypt -> unzip command
// ============================================================
function runTest2() {
    console.log("【测试 2】JSZip 加密 -> unzip 命令解密\n");
    
    var jszipZipPath = path.join(testDir, "test_jszip_encrypted.zip");
    var extractDir = path.join(testDir, "extracted_test");
    
    var zip = new JSZip();
    zip.file("test_file1.txt", testContent1);
    zip.file("test_file2.json", testContent2);
    
    console.log("步骤 2.1: 使用 JSZip 创建加密文件...");
    
    return zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        password: testPassword,
        encryptionMethod: "traditional"
    }).then(function(content) {
        fs.writeFileSync(jszipZipPath, content);
        console.log("✓ JSZip 加密文件已创建\n");
        
        // Try to decrypt with unzip command
        console.log("步骤 2.2: 使用 unzip 命令解密...");
        
        try {
            // Create extraction directory
            if (!fs.existsSync(extractDir)) {
                fs.mkdirSync(extractDir);
            }
            
            // Try unzip
            execSync('unzip -P "' + testPassword + '" "' + jszipZipPath + '" -d "' + extractDir + '"', {
                stdio: 'pipe'
            });
            
            console.log("✓ unzip 命令执行成功\n");
            
            // Verify extracted files
            var extracted1 = fs.readFileSync(path.join(extractDir, "test_file1.txt"), "utf8");
            var extracted2 = fs.readFileSync(path.join(extractDir, "test_file2.json"), "utf8");
            
            var test1Pass = (extracted1 === testContent1);
            var test2Pass = (extracted2 === testContent2);
            
            reportTest("测试 2.1: JSZip加密 -> unzip解密 (文件1)", test1Pass,
                test1Pass ? null : "内容不匹配");
            reportTest("测试 2.2: JSZip加密 -> unzip解密 (文件2)", test2Pass,
                test2Pass ? null : "内容不匹配");
            
            console.log("");
            return runTest3();
            
        } catch (err) {
            reportTest("测试 2: JSZip加密 -> unzip解密", false, err.message);
            console.log("unzip 输出:", err.stdout ? err.stdout.toString() : "");
            console.log("unzip 错误:", err.stderr ? err.stderr.toString() : "");
            console.log("");
            return runTest3();
        }
    });
}

// ============================================================
// Test 3: JSZip encrypt -> JSZip decrypt (baseline)
// ============================================================
function runTest3() {
    console.log("【测试 3】JSZip 加密 -> JSZip 解密 (基线测试)\n");
    
    var zip = new JSZip();
    zip.file("test_file1.txt", testContent1);
    zip.file("test_file2.json", testContent2);
    
    return zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        password: testPassword,
        encryptionMethod: "traditional"
    }).then(function(content) {
        return JSZip.loadAsync(content, { password: testPassword });
    }).then(function(zip) {
        return Promise.all([
            zip.file("test_file1.txt").async("string"),
            zip.file("test_file2.json").async("string")
        ]);
    }).then(function(results) {
        var content1 = results[0];
        var content2 = results[1];
        
        var test1Pass = (content1 === testContent1);
        var test2Pass = (content2 === testContent2);
        
        reportTest("测试 3.1: JSZip加密 -> JSZip解密 (文件1)", test1Pass,
            test1Pass ? null : "内容不匹配");
        reportTest("测试 3.2: JSZip加密 -> JSZip解密 (文件2)", test2Pass,
            test2Pass ? null : "内容不匹配");
        
        console.log("");
        printSummary();
    }).catch(function(err) {
        reportTest("测试 3: JSZip加密 -> JSZip解密", false, err.message);
        console.log("");
        printSummary();
    });
}

function printSummary() {
    console.log("=".repeat(60));
    console.log("测试总结");
    console.log("=".repeat(60));
    console.log("通过: " + testsPassed);
    console.log("失败: " + testsFailed);
    console.log("总计: " + (testsPassed + testsFailed));
    console.log("");
    
    if (testsFailed === 0) {
        console.log("✓ 所有测试通过！");
        cleanup();
        process.exit(0);
    } else {
        console.log("✗ 有测试失败，请检查上述错误信息");
        console.log("提示: 测试文件保留在 test/ 目录以便调试");
        process.exit(1);
    }
}

