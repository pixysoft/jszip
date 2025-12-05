"use strict";

/**
 * Encryption utilities for JSZip
 * Provides helper functions for encryption/decryption operations
 */

var crc32fn = require("../crc32");

/**
 * Generate CRC32 table (reuse from crc32.js logic)
 */
function makeTable() {
    var c, table = [];
    for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
    }
    return table;
}

var crcTable = makeTable();

/**
 * Fast CRC32 calculation for a single byte
 * @param {number} crc - Current CRC value
 * @param {number} byte - Byte to process
 * @return {number} Updated CRC value
 */
function updateCRC32(crc, byte) {
    return (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xFF];
}

/**
 * Calculate CRC32 for data
 * @param {Uint8Array|Array|String} data - Data to calculate CRC for
 * @return {number} CRC32 value
 */
function calculateCRC32(data) {
    return crc32fn(data, 0);
}

/**
 * Convert string to byte array (for password processing)
 * @param {string} str - String to convert
 * @return {Uint8Array} Byte array
 */
function stringToBytes(str) {
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return bytes;
}

/**
 * Ensure data is in Uint8Array format
 * @param {any} data - Input data
 * @return {Uint8Array} Uint8Array
 */
function ensureUint8Array(data) {
    if (data instanceof Uint8Array) {
        return data;
    }
    if (typeof data === "string") {
        return stringToBytes(data);
    }
    if (Array.isArray(data)) {
        return new Uint8Array(data);
    }
    // Assume it's already array-like
    return new Uint8Array(data);
}

/**
 * XOR two byte arrays
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @return {Uint8Array} XOR result
 */
function xorBytes(a, b) {
    var result = new Uint8Array(Math.min(a.length, b.length));
    for (var i = 0; i < result.length; i++) {
        result[i] = a[i] ^ b[i];
    }
    return result;
}

module.exports = {
    updateCRC32: updateCRC32,
    calculateCRC32: calculateCRC32,
    stringToBytes: stringToBytes,
    ensureUint8Array: ensureUint8Array,
    xorBytes: xorBytes
};

