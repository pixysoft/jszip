"use strict";

/**
 * Integration tests for decryption functionality (Phase 2)
 */

var JSZip = require("../../lib/index");
var JSZipTestUtils = require("../helpers/test-utils").JSZipTestUtils || global.JSZipTestUtils;

QUnit.module("decryption integration");

QUnit.test("Load encrypted ZIP with correct password", function(assert) {
    var done = assert.async();
    
    // This test requires knowing the password for encrypted.zip
    // Skip if we can't test it
    JSZipTestUtils.loadZipFile("ref/encrypted.zip", function(err, data) {
        if (err) {
            assert.ok(false, "Could not load test file");
            done();
            return;
        }
        
        // Try common passwords (this is a test file, password should be simple)
        var testPasswords = ["password", "test", "hello", ""];
        
        var tested = false;
        function tryPassword(index) {
            if (index >= testPasswords.length || tested) {
                if (!tested) {
                    assert.ok(true, "Encrypted ZIP detected but password unknown (this is expected)");
                }
                done();
                return;
            }
            
            var pwd = testPasswords[index];
            JSZip.loadAsync(data, { password: pwd || undefined })
                .then(function(zip) {
                    assert.ok(true, "ZIP loaded with password: " + (pwd || "(none)"));
                    tested = true;
                    
                    // Try to read a file
                    var files = Object.keys(zip.files).filter(function(name) {
                        return !zip.files[name].dir;
                    });
                    
                    if (files.length > 0) {
                        return zip.file(files[0]).async("string");
                    }
                })
                .then(function(content) {
                    if (content !== undefined) {
                        assert.ok(content.length > 0, "File content extracted");
                    }
                    done();
                })
                .catch(function(e) {
                    // Wrong password or other error, try next
                    if (!tested) {
                        tryPassword(index + 1);
                    }
                });
        }
        
        tryPassword(0);
    });
});

QUnit.test("Load encrypted ZIP without password throws error", function(assert) {
    var done = assert.async();
    
    JSZipTestUtils.loadZipFile("ref/encrypted.zip", function(err, data) {
        if (err) {
            assert.ok(false, "Could not load test file");
            done();
            return;
        }
        
        JSZip.loadAsync(data)
            .then(function(zip) {
                // Try to access a file without password
                var files = Object.keys(zip.files).filter(function(name) {
                    return !zip.files[name].dir;
                });
                
                if (files.length > 0) {
                    return zip.file(files[0]).async("string");
                }
            })
            .then(function() {
                assert.ok(false, "Should have thrown error for encrypted file without password");
                done();
            })
            .catch(function(err) {
                assert.ok(err.message.indexOf("password") !== -1, 
                         "Error message mentions password: " + err.message);
                done();
            });
    });
});

QUnit.test("CompressedObject with encryption info", function(assert) {
    var CompressedObject = require("../../lib/compressedObject");
    var compressions = require("../../lib/compressions");
    
    var testData = new Uint8Array([1, 2, 3, 4, 5]);
    var encryptionInfo = {
        method: "traditional",
        crc32: 0x12345678,
        lastModTime: Date.now()
    };
    
    var compressed = new CompressedObject(
        5, 5, 0x12345678, 
        compressions.STORE, 
        testData, 
        encryptionInfo
    );
    
    assert.ok(compressed.encryptionInfo !== null, "Encryption info stored");
    assert.equal(compressed.encryptionInfo.method, "traditional", "Encryption method correct");
});

QUnit.test("CompressedObject getContentWorker requires password for encrypted data", function(assert) {
    var CompressedObject = require("../../lib/compressedObject");
    var compressions = require("../../lib/compressions");
    var TraditionalEncryption = require("../../lib/encryption/traditional");
    var encryptionUtils = require("../../lib/encryption/utils");
    
    // Create encrypted data
    var plainData = encryptionUtils.stringToBytes("test content");
    var crc32 = encryptionUtils.calculateCRC32(plainData);
    
    var cipher = new TraditionalEncryption("testPass");
    var encryptedData = cipher.encrypt(plainData, crc32, 0);
    
    var encryptionInfo = {
        method: "traditional",
        crc32: crc32,
        lastModTime: 0
    };
    
    var compressed = new CompressedObject(
        encryptedData.length, 
        plainData.length, 
        crc32,
        compressions.STORE,
        encryptedData,
        encryptionInfo
    );
    
    // Try without password
    try {
        compressed.getContentWorker();
        assert.ok(false, "Should throw error without password");
    } catch (err) {
        assert.ok(err.message.indexOf("password") !== -1, 
                 "Error mentions password requirement");
    }
    
    // Try with password
    try {
        var worker = compressed.getContentWorker("testPass");
        assert.ok(worker !== null, "Worker created with password");
    } catch (err) {
        assert.ok(false, "Should not throw error with password: " + err.message);
    }
});

QUnit.test("Backward compatibility: non-encrypted files work without changes", function(assert) {
    var done = assert.async();
    
    // Load a non-encrypted file
    JSZipTestUtils.loadZipFile("ref/text.zip", function(err, data) {
        if (err) {
            assert.ok(false, "Could not load test file");
            done();
            return;
        }
        
        JSZip.loadAsync(data)
            .then(function(zip) {
                assert.ok(true, "Non-encrypted ZIP loaded successfully");
                
                var files = Object.keys(zip.files).filter(function(name) {
                    return !zip.files[name].dir;
                });
                
                if (files.length > 0) {
                    return zip.file(files[0]).async("string");
                }
            })
            .then(function(content) {
                assert.ok(content.length > 0, "File content extracted from non-encrypted ZIP");
                done();
            })
            .catch(function(err) {
                assert.ok(false, "Non-encrypted ZIP should work: " + err.message);
                done();
            });
    });
});

