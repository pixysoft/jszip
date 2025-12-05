"use strict";

var GenericWorker = require("./GenericWorker");
var utils = require("../utils");
var TraditionalEncryption = require("../encryption/traditional");

/**
 * A worker that encrypts ZIP data
 * @constructor
 * @param {Object} options - Encryption options
 * @param {string} options.password - Password for encryption
 * @param {string} options.method - Encryption method ('traditional' or 'aes')
 * @param {number} options.crc32 - CRC32 of original file
 * @param {number} options.dosDateRaw - Raw DOS date (32-bit value)
 * @param {number} options.bitFlag - General purpose bit flag
 */
function EncryptWorker(options) {
    GenericWorker.call(this, "EncryptWorker");
    
    this.password = options.password;
    this.method = options.method || "traditional";
    this.crc32 = options.crc32 || 0;
    this.dosDateRaw = options.dosDateRaw || 0;
    this.bitFlag = options.bitFlag || 0;
    
    this.cipher = null;
    this.headerEmitted = false;
    this.allData = [];
}

utils.inherits(EncryptWorker, GenericWorker);

/**
 * Initialize the cipher based on method
 */
EncryptWorker.prototype.initCipher = function() {
    if (this.method === "traditional") {
        this.cipher = new TraditionalEncryption(this.password);
        this.cipher.initKeys();
    } else if (this.method === "aes") {
        throw new Error("AES encryption is not yet implemented");
    } else {
        throw new Error("Unknown encryption method: " + this.method);
    }
};

/**
 * @see GenericWorker.processChunk
 */
EncryptWorker.prototype.processChunk = function(chunk) {
    if (!this.cipher) {
        this.initCipher();
    }

    var data = utils.transformTo("uint8array", chunk.data);
    
    // For traditional encryption, we need to collect all data first
    // because the header depends on CRC32 which requires full data
    this.allData.push(data);
    
    // Don't emit anything yet - wait for flush
};

/**
 * @see GenericWorker.flush
 */
EncryptWorker.prototype.flush = function() {
    if (!this.cipher) {
        this.initCipher();
    }

    // Get CRC32 from streamInfo if available
    var crc32 = this.streamInfo && this.streamInfo.crc32 ? this.streamInfo.crc32 : this.crc32;

    // Combine all collected data
    var totalLength = 0;
    for (var i = 0; i < this.allData.length; i++) {
        totalLength += this.allData[i].length;
    }

    var combined = new Uint8Array(totalLength);
    var offset = 0;
    for (var j = 0; j < this.allData.length; j++) {
        combined.set(this.allData[j], offset);
        offset += this.allData[j].length;
    }

    // Encrypt all data (including header generation)
    var encrypted;
    
    if (this.method === "traditional") {
        // For traditional encryption, use CRC32 high byte for verification
        // (bit 3 is typically not set when creating new encrypted files)
        encrypted = this.cipher.encrypt(combined, crc32, this.dosDateRaw);
    }

    // Update streamInfo with new compressed size (original + 12 bytes header)
    this.streamInfo["compressedSize"] = encrypted.length;
    
    // Emit encrypted data
    this.push({
        data: encrypted,
        meta: {
            percent: 100
        }
    });

    GenericWorker.prototype.flush.call(this);
};

/**
 * @see GenericWorker.cleanUp
 */
EncryptWorker.prototype.cleanUp = function() {
    GenericWorker.prototype.cleanUp.call(this);
    this.cipher = null;
    this.allData = null;
};

module.exports = EncryptWorker;

