"use strict";

/**
 * ZIP 2.0 Traditional (PKWARE) Encryption
 * 
 * This implements the legacy ZIP encryption algorithm as specified in APPNOTE.TXT
 * Note: This encryption is NOT secure by modern standards and should only be used
 * for basic data obfuscation, not for protecting sensitive information.
 * 
 * Algorithm:
 * - Uses three 32-bit keys initialized with password
 * - Each byte is encrypted using keys and updated after processing
 * - 12-byte encryption header is prepended (for password verification)
 */

var encryptionUtils = require("./utils");

/**
 * Traditional ZIP encryption class
 * @constructor
 * @param {string} password - The password for encryption/decryption
 */
function TraditionalEncryption(password) {
    this.password = password;
    this.keys = null;
}

TraditionalEncryption.prototype = {
    /**
     * Initialize encryption keys based on password
     */
    initKeys: function() {
        this.keys = [0x12345678, 0x23456789, 0x34567890];
        
        for (var i = 0; i < this.password.length; i++) {
            this.updateKeys(this.password.charCodeAt(i) & 0xFF);
        }
    },

    /**
     * Update the three encryption keys with a single byte
     * @param {number} byte - Byte value to update keys with
     */
    updateKeys: function(byte) {
        this.keys[0] = encryptionUtils.updateCRC32(this.keys[0], byte);
        this.keys[1] = (this.keys[1] + (this.keys[0] & 0xFF)) >>> 0;
        this.keys[1] = (Math.imul(this.keys[1], 134775813) + 1) >>> 0;
        this.keys[2] = encryptionUtils.updateCRC32(this.keys[2], (this.keys[1] >>> 24) & 0xFF);
    },

    /**
     * Decrypt a single byte
     * @param {number} byte - Encrypted byte
     * @return {number} Decrypted byte
     */
    decryptByte: function(byte) {
        var temp = (this.keys[2] | 2) & 0xFFFF;
        var decrypted = byte ^ (((temp * (temp ^ 1)) >>> 8) & 0xFF);
        this.updateKeys(decrypted);
        return decrypted;
    },

    /**
     * Encrypt a single byte
     * @param {number} byte - Plain byte
     * @return {number} Encrypted byte
     */
    encryptByte: function(byte) {
        var temp = (this.keys[2] | 2) & 0xFFFF;
        var encrypted = byte ^ (((temp * (temp ^ 1)) >>> 8) & 0xFF);
        this.updateKeys(byte);
        return encrypted;
    },

    /**
     * Decrypt data buffer
     * @param {Uint8Array} data - Encrypted data (including 12-byte header)
     * @param {number} crc32 - CRC32 of original file (for verification)
     * @param {number} lastModTime - Last modification time (alternative verification)
     * @return {Object} {data: Uint8Array, valid: boolean}
     */
    decrypt: function(data, crc32, lastModTime) {
        if (!this.keys) {
            this.initKeys();
        }

        // Decrypt and verify 12-byte header
        var header = new Uint8Array(12);
        for (var i = 0; i < 12; i++) {
            header[i] = this.decryptByte(data[i]);
        }

        // Verify password using last byte(s) of header
        // According to APPNOTE.TXT:
        // - PKZIP < 2.0: uses 2 bytes (header[10-11]) = CRC32 >> 8 (bytes 1-2 of CRC)
        // - PKZIP >= 2.0: uses 1 byte (header[11]) = CRC32 >> 24 (byte 3 of CRC)  
        // Some implementations also accept time byte as alternative
        var checkByte = header[11];
        var checkByte2 = header[10];
        
        // Try multiple verification methods for compatibility
        var valid = (checkByte === ((crc32 >>> 24) & 0xFF)) ||  // PKZIP 2.0+ CRC high byte
                    (checkByte === ((lastModTime >>> 8) & 0xFF)) ||  // Time high byte
                    (checkByte === ((crc32 >>> 16) & 0xFF) && checkByte2 === ((crc32 >>> 8) & 0xFF)); // PKZIP < 2.0 (2 bytes)

        if (!valid) {
            return {
                data: null,
                valid: false
            };
        }

        // Decrypt actual data (skip 12-byte header)
        var decrypted = new Uint8Array(data.length - 12);
        for (var j = 0; j < decrypted.length; j++) {
            decrypted[j] = this.decryptByte(data[j + 12]);
        }

        return {
            data: decrypted,
            valid: true
        };
    },

    /**
     * Encrypt data buffer
     * @param {Uint8Array} data - Plain data
     * @param {number} crc32 - CRC32 of original file (for header)
     * @param {number} dosDateRaw - DOS date/time (not used for PKZIP 2.0+ encryption)
     * @return {Uint8Array} Encrypted data with 12-byte header
     */
    encrypt: function(data, crc32, dosDateRaw) {
        if (!this.keys) {
            this.initKeys();
        }

        // Create 12-byte encryption header
        // First 11 bytes are random, 12th byte is for verification
        var header = new Uint8Array(12);
        
        // Generate cryptographically secure random header
        try {
            // Try Node.js crypto
            if (typeof require !== 'undefined') {
                try {
                    var crypto = require('crypto');
                    var randomBytes = crypto.randomBytes(11);
                    for (var i = 0; i < 11; i++) {
                        header[i] = randomBytes[i];
                    }
                } catch (e) {
                    // Fallback if crypto not available
                    throw e;
                }
            } else if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
                // Browser crypto
                window.crypto.getRandomValues(header.subarray(0, 11));
            } else {
                throw new Error('No secure random available');
            }
        } catch (e) {
            // Fallback to Math.random (not cryptographically secure, but works)
            for (var j = 0; j < 11; j++) {
                header[j] = (Math.random() * 256) | 0;
            }
        }
        
        // Last byte for password verification
        // PKZIP 2.0+ uses CRC32 high byte (most compatible)
        header[11] = (crc32 >>> 24) & 0xFF;

        // Encrypt header
        var encryptedHeader = new Uint8Array(12);
        for (var j = 0; j < 12; j++) {
            encryptedHeader[j] = this.encryptByte(header[j]);
        }

        // Encrypt data
        var encryptedData = new Uint8Array(data.length);
        for (var k = 0; k < data.length; k++) {
            encryptedData[k] = this.encryptByte(data[k]);
        }

        // Combine header and data
        var result = new Uint8Array(12 + data.length);
        result.set(encryptedHeader, 0);
        result.set(encryptedData, 12);

        return result;
    },

    /**
     * Reset keys (for processing multiple files with same password)
     */
    reset: function() {
        this.keys = null;
    }
};

module.exports = TraditionalEncryption;

