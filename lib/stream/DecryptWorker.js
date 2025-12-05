"use strict";

var GenericWorker = require("./GenericWorker");
var utils = require("../utils");
var TraditionalEncryption = require("../encryption/traditional");

/**
 * A worker that decrypts encrypted ZIP data
 * @constructor
 * @param {Object} options - Decryption options
 * @param {string} options.password - Password for decryption
 * @param {string} options.method - Encryption method ('traditional' or 'aes')
 * @param {number} options.crc32 - CRC32 of original file
 * @param {number} options.dosDateRaw - Raw DOS date (32-bit value)
 * @param {number} options.bitFlag - General purpose bit flag from ZIP header
 */
function DecryptWorker(options) {
    GenericWorker.call(this, "DecryptWorker");

    this.password = options.password;
    this.method = options.method || "traditional";
    this.crc32 = options.crc32 || 0;
    this.dosDateRaw = options.dosDateRaw || 0;
    this.bitFlag = options.bitFlag || 0;

    // Validate encryption method immediately
    this.validateEncryptionMethod();

    this.cipher = null;
    this.headerProcessed = false;
    this.buffer = null;
}

utils.inherits(DecryptWorker, GenericWorker);

/**
 * Validate encryption method and throw error if unsupported
 * @private
 */
DecryptWorker.prototype.validateEncryptionMethod = function () {
    if (this.method !== "traditional") {
        var errorMsg;
        if (this.method === "aes") {
            errorMsg = "AES encryption is not supported. Only ZIP 2.0 Traditional (PKWARE) encryption is currently implemented.";
        } else {
            errorMsg = "Unsupported encryption method: '" + this.method + "'. Only 'traditional' encryption is supported.";
        }
        throw new Error(errorMsg);
    }
};

/**
 * Initialize the cipher based on method
 */
DecryptWorker.prototype.initCipher = function () {
    // Method is already validated in constructor
    this.cipher = new TraditionalEncryption(this.password);
};

/**
 * @see GenericWorker.processChunk
 */
DecryptWorker.prototype.processChunk = function (chunk) {
    if (!this.cipher) {
        this.initCipher();
    }

    var data = utils.transformTo("uint8array", chunk.data);

    // Process encryption header
    if (!this.headerProcessed) {
        data = this.processHeader(data);
        if (!data) {
            return; // Still buffering or header only
        }
    }

    // Decrypt data
    var decrypted = this.decryptData(data);

    if (decrypted && decrypted.length > 0) {
        this.push({
            data: decrypted,
            meta: chunk.meta
        });
    }
};

/**
 * Process and verify encryption header
 * @private
 */
DecryptWorker.prototype.processHeader = function (data) {
    // Buffer data until we have enough for header
    if (this.buffer) {
        var combined = new Uint8Array(this.buffer.length + data.length);
        combined.set(this.buffer, 0);
        combined.set(data, this.buffer.length);
        data = combined;
        this.buffer = null;
    }

    // Traditional encryption requires 12-byte header
    if (data.length < 12) {
        this.buffer = data;
        return null;
    }

    // Initialize cipher keys
    if (!this.cipher.keys) {
        this.cipher.initKeys();
    }

    // Decrypt and verify header
    var header = new Uint8Array(12);
    for (var i = 0; i < 12; i++) {
        header[i] = this.cipher.decryptByte(data[i]);
    }

    // Verify password using last byte(s) of header
    // According to APPNOTE.TXT and adm-zip implementation:
    // - If bit 3 (0x08, FLG_DESC) is set: use time high byte
    // - Otherwise: use CRC high byte
    var checkByte = header[11];
    var verifyByte;
    
    if ((this.bitFlag & 0x08) === 0x08) {
        // Bit 3 set: use DOS time high byte (bits 8-15)
        verifyByte = (this.dosDateRaw >>> 8) & 0xFF;
    } else {
        // Bit 3 not set: use CRC high byte
        verifyByte = ((this.crc32 >>> 0) >>> 24) & 0xFF;
    }
    
    var valid = (checkByte === verifyByte);

    if (!valid) {
        this.error(new Error("Incorrect password or corrupted data"));
        return null;
    }

    this.headerProcessed = true;

    // Return data without header
    return data.length > 12 ? data.subarray(12) : null;
};

/**
 * Decrypt data chunk
 * @private
 */
DecryptWorker.prototype.decryptData = function (data) {
    var decrypted = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i++) {
        decrypted[i] = this.cipher.decryptByte(data[i]);
    }
    return decrypted;
};

/**
 * @see GenericWorker.flush
 */
DecryptWorker.prototype.flush = function () {
    // Process any remaining buffered data
    if (this.buffer && this.buffer.length > 0) {
        this.error(new Error("Incomplete encrypted data"));
    }
    GenericWorker.prototype.flush.call(this);
};

/**
 * @see GenericWorker.cleanUp
 */
DecryptWorker.prototype.cleanUp = function () {
    GenericWorker.prototype.cleanUp.call(this);
    this.cipher = null;
    this.buffer = null;
};

module.exports = DecryptWorker;

