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
 * @param {number} options.lastModTime - Last modification time
 */
function DecryptWorker(options) {
    GenericWorker.call(this, "DecryptWorker");
    
    this.password = options.password;
    this.method = options.method || "traditional";
    this.crc32 = options.crc32 || 0;
    this.lastModTime = options.lastModTime || 0;
    
    this.cipher = null;
    this.headerProcessed = false;
    this.buffer = null;
}

utils.inherits(DecryptWorker, GenericWorker);

/**
 * Initialize the cipher based on method
 */
DecryptWorker.prototype.initCipher = function() {
    if (this.method === "traditional") {
        this.cipher = new TraditionalEncryption(this.password);
    } else if (this.method === "aes") {
        throw new Error("AES encryption is not yet implemented");
    } else {
        throw new Error("Unknown encryption method: " + this.method);
    }
};

/**
 * @see GenericWorker.processChunk
 */
DecryptWorker.prototype.processChunk = function(chunk) {
    if (!this.cipher) {
        this.initCipher();
    }

    var data = utils.transformTo("uint8array", chunk.data);

    // For traditional encryption, we need at least 12 bytes for the header
    if (!this.headerProcessed) {
        // Buffer data until we have enough for header
        if (this.buffer) {
            var combined = new Uint8Array(this.buffer.length + data.length);
            combined.set(this.buffer, 0);
            combined.set(data, this.buffer.length);
            data = combined;
            this.buffer = null;
        }

        if (this.method === "traditional" && data.length < 12) {
            // Not enough data yet, buffer it
            this.buffer = data;
            return;
        }

        this.headerProcessed = true;
    }

    // Decrypt data chunk by chunk
    var decrypted;
    
    if (this.method === "traditional") {
        // Use the cipher.decrypt method which handles the full process
        var result = this.cipher.decrypt(data, this.crc32, this.lastModTime);
        
        if (!result.valid) {
            this.error(new Error("Incorrect password or corrupted data"));
            return;
        }
        
        decrypted = result.data;
    }

    if (decrypted && decrypted.length > 0) {
        this.push({
            data: decrypted,
            meta: chunk.meta
        });
    }
};

/**
 * @see GenericWorker.flush
 */
DecryptWorker.prototype.flush = function() {
    // Process any remaining buffered data
    if (this.buffer && this.buffer.length > 0) {
        this.error(new Error("Incomplete encrypted data"));
    }
    GenericWorker.prototype.flush.call(this);
};

/**
 * @see GenericWorker.cleanUp
 */
DecryptWorker.prototype.cleanUp = function() {
    GenericWorker.prototype.cleanUp.call(this);
    this.cipher = null;
    this.buffer = null;
};

module.exports = DecryptWorker;

