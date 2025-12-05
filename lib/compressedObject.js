"use strict";

var external = require("./external");
var DataWorker = require("./stream/DataWorker");
var Crc32Probe = require("./stream/Crc32Probe");
var DataLengthProbe = require("./stream/DataLengthProbe");

/**
 * Represent a compressed object, with everything needed to decompress it.
 * @constructor
 * @param {number} compressedSize the size of the data compressed.
 * @param {number} uncompressedSize the size of the data after decompression.
 * @param {number} crc32 the crc32 of the decompressed file.
 * @param {object} compression the type of compression, see lib/compressions.js.
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the compressed data.
 * @param {object} encryptionInfo the encryption information (optional).
 */
function CompressedObject(compressedSize, uncompressedSize, crc32, compression, data, encryptionInfo) {
    this.compressedSize = compressedSize;
    this.uncompressedSize = uncompressedSize;
    this.crc32 = crc32;
    this.compression = compression;
    this.compressedContent = data;
    this.encryptionInfo = encryptionInfo || null;
}

CompressedObject.prototype = {
    /**
     * Create a worker to get the uncompressed content.
     * @param {string} password Optional password for encrypted files.
     * @return {GenericWorker} the worker.
     */
    getContentWorker: function (password) {
        var worker = new DataWorker(external.Promise.resolve(this.compressedContent));
        
        // Insert DecryptWorker if file is encrypted
        if (this.encryptionInfo) {
            if (!password) {
                throw new Error("Encrypted zip file requires a password");
            }
            
            var DecryptWorker = require("./stream/DecryptWorker");
            worker = worker.pipe(new DecryptWorker({
                password: password,
                method: this.encryptionInfo.method,
                crc32: this.encryptionInfo.crc32,
                dosDateRaw: this.encryptionInfo.dosDateRaw,
                bitFlag: this.encryptionInfo.bitFlag
            }));
        }
        
        worker = worker
            .pipe(this.compression.uncompressWorker())
            .pipe(new DataLengthProbe("data_length"));

        var that = this;
        worker.on("end", function () {
            if (this.streamInfo["data_length"] !== that.uncompressedSize) {
                throw new Error("Bug : uncompressed data size mismatch");
            }
        });
        return worker;
    },
    /**
     * Create a worker to get the compressed content.
     * @return {GenericWorker} the worker.
     */
    getCompressedWorker: function () {
        return new DataWorker(external.Promise.resolve(this.compressedContent))
            .withStreamInfo("compressedSize", this.compressedSize)
            .withStreamInfo("uncompressedSize", this.uncompressedSize)
            .withStreamInfo("crc32", this.crc32)
            .withStreamInfo("compression", this.compression)
        ;
    }
};

/**
 * Chain the given worker with other workers to compress the content with the
 * given compression.
 * @param {GenericWorker} uncompressedWorker the worker to pipe.
 * @param {Object} compression the compression object.
 * @param {Object} compressionOptions the options to use when compressing.
 * @return {GenericWorker} the new worker compressing the content.
 */
CompressedObject.createWorkerFrom = function (uncompressedWorker, compression, compressionOptions) {
    return uncompressedWorker
        .pipe(new Crc32Probe())
        .pipe(new DataLengthProbe("uncompressedSize"))
        .pipe(compression.compressWorker(compressionOptions))
        .pipe(new DataLengthProbe("compressedSize"))
        .withStreamInfo("compression", compression);
};

module.exports = CompressedObject;
