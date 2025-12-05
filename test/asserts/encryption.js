"use strict";

var JSZip = require("../../lib/index");
var TraditionalEncryption = require("../../lib/encryption/traditional");
var encryptionUtils = require("../../lib/encryption/utils");

QUnit.module("encryption utilities");

QUnit.test("CRC32 calculation", function(assert) {
    var data = encryptionUtils.stringToBytes("Hello World");
    var crc = encryptionUtils.calculateCRC32(data);
    assert.ok(typeof crc === "number", "CRC32 should return a number");
    assert.ok(crc !== 0, "CRC32 should not be zero for non-empty data");
});

QUnit.test("String to bytes conversion", function(assert) {
    var str = "password";
    var bytes = encryptionUtils.stringToBytes(str);
    assert.ok(bytes instanceof Uint8Array, "Should return Uint8Array");
    assert.equal(bytes.length, str.length, "Length should match");
    assert.equal(bytes[0], str.charCodeAt(0), "First byte should match");
});

QUnit.test("Ensure Uint8Array conversion", function(assert) {
    var str = "test";
    var arr = [1, 2, 3];
    var uint8 = new Uint8Array([4, 5, 6]);
    
    assert.ok(encryptionUtils.ensureUint8Array(str) instanceof Uint8Array, "String converted");
    assert.ok(encryptionUtils.ensureUint8Array(arr) instanceof Uint8Array, "Array converted");
    assert.ok(encryptionUtils.ensureUint8Array(uint8) instanceof Uint8Array, "Uint8Array preserved");
});

QUnit.module("traditional encryption");

QUnit.test("Encryption key initialization", function(assert) {
    var cipher = new TraditionalEncryption("password");
    cipher.initKeys();
    
    assert.ok(cipher.keys !== null, "Keys should be initialized");
    assert.equal(cipher.keys.length, 3, "Should have 3 keys");
    assert.ok(cipher.keys[0] !== 0x12345678, "Key 0 should be updated from initial value");
});

QUnit.test("Encrypt and decrypt single byte", function(assert) {
    var cipher = new TraditionalEncryption("test123");
    cipher.initKeys();
    
    var originalByte = 0x42;
    var encrypted = cipher.encryptByte(originalByte);
    
    // Reset and decrypt
    var cipher2 = new TraditionalEncryption("test123");
    cipher2.initKeys();
    var decrypted = cipher2.decryptByte(encrypted);
    
    assert.equal(decrypted, originalByte, "Decrypted byte should match original");
});

QUnit.test("Encrypt and decrypt data buffer", function(assert) {
    var password = "myPassword123";
    var originalData = encryptionUtils.stringToBytes("Hello World! This is a test.");
    var crc32 = encryptionUtils.calculateCRC32(originalData);
    
    // Encrypt
    var cipher1 = new TraditionalEncryption(password);
    var encrypted = cipher1.encrypt(originalData, crc32, 0);
    
    assert.ok(encrypted.length > originalData.length, "Encrypted data should be longer (includes header)");
    assert.equal(encrypted.length, originalData.length + 12, "Should add 12-byte header");
    
    // Decrypt
    var cipher2 = new TraditionalEncryption(password);
    var result = cipher2.decrypt(encrypted, crc32, 0);
    
    assert.ok(result.valid, "Password should be validated successfully");
    assert.ok(result.data !== null, "Decrypted data should exist");
    assert.equal(result.data.length, originalData.length, "Decrypted length should match");
    
    // Verify content
    var match = true;
    for (var i = 0; i < originalData.length; i++) {
        if (result.data[i] !== originalData[i]) {
            match = false;
            break;
        }
    }
    assert.ok(match, "Decrypted data should match original");
});

QUnit.test("Decrypt with wrong password", function(assert) {
    var originalData = encryptionUtils.stringToBytes("Secret message");
    var crc32 = encryptionUtils.calculateCRC32(originalData);
    
    // Encrypt with one password
    var cipher1 = new TraditionalEncryption("correct");
    var encrypted = cipher1.encrypt(originalData, crc32, 0);
    
    // Try to decrypt with wrong password
    var cipher2 = new TraditionalEncryption("wrong");
    var result = cipher2.decrypt(encrypted, crc32, 0);
    
    assert.ok(!result.valid, "Should detect wrong password");
    assert.equal(result.data, null, "Should not return data for wrong password");
});

QUnit.test("Empty data encryption", function(assert) {
    var emptyData = new Uint8Array(0);
    var crc32 = 0;
    
    var cipher = new TraditionalEncryption("password");
    var encrypted = cipher.encrypt(emptyData, crc32, 0);
    
    assert.equal(encrypted.length, 12, "Should have 12-byte header even for empty data");
});

QUnit.test("Large data encryption performance", function(assert) {
    var done = assert.async();
    
    // Create 1MB of data
    var largeData = new Uint8Array(1024 * 1024);
    for (var i = 0; i < largeData.length; i++) {
        largeData[i] = i & 0xFF;
    }
    
    var crc32 = encryptionUtils.calculateCRC32(largeData);
    var password = "testPassword";
    
    var startTime = Date.now();
    
    // Encrypt
    var cipher1 = new TraditionalEncryption(password);
    var encrypted = cipher1.encrypt(largeData, crc32, 0);
    
    // Decrypt
    var cipher2 = new TraditionalEncryption(password);
    var result = cipher2.decrypt(encrypted, crc32, 0);
    
    var endTime = Date.now();
    var duration = endTime - startTime;
    
    assert.ok(result.valid, "Should decrypt large data successfully");
    assert.equal(result.data.length, largeData.length, "Length should match");
    assert.ok(duration < 5000, "Should complete within 5 seconds (took " + duration + "ms)");
    
    done();
});

QUnit.test("Multiple file encryption with same password", function(assert) {
    var password = "sharedPassword";
    
    var file1 = encryptionUtils.stringToBytes("File 1 content");
    var file2 = encryptionUtils.stringToBytes("File 2 content");
    
    var crc1 = encryptionUtils.calculateCRC32(file1);
    var crc2 = encryptionUtils.calculateCRC32(file2);
    
    // Encrypt both files
    var cipher = new TraditionalEncryption(password);
    var encrypted1 = cipher.encrypt(file1, crc1, 0);
    
    cipher.reset();
    var encrypted2 = cipher.encrypt(file2, crc2, 0);
    
    // Decrypt both
    cipher.reset();
    var result1 = cipher.decrypt(encrypted1, crc1, 0);
    
    cipher.reset();
    var result2 = cipher.decrypt(encrypted2, crc2, 0);
    
    assert.ok(result1.valid && result2.valid, "Both files should decrypt successfully");
});

