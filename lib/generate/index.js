"use strict";

var compressions = require("../compressions");
var ZipFileWorker = require("./ZipFileWorker");

/**
 * Find the compression to use.
 * @param {String} fileCompression the compression defined at the file level, if any.
 * @param {String} zipCompression the compression defined at the load() level.
 * @return {Object} the compression object to use.
 */
var getCompression = function (fileCompression, zipCompression) {

    var compressionName = fileCompression || zipCompression;
    var compression = compressions[compressionName];
    if (!compression) {
        throw new Error(compressionName + " is not a valid compression method !");
    }
    return compression;
};

/**
 * Convert JavaScript Date to DOS date/time format (32-bit value)
 * @param {Date} date - JavaScript Date object
 * @return {number} DOS date/time as 32-bit integer
 */
var dateToDOS = function(date) {
    var dosTime = date.getUTCHours();
    dosTime = dosTime << 6;
    dosTime = dosTime | date.getUTCMinutes();
    dosTime = dosTime << 5;
    dosTime = dosTime | (date.getUTCSeconds() / 2);

    var dosDate = date.getUTCFullYear() - 1980;
    dosDate = dosDate << 4;
    dosDate = dosDate | (date.getUTCMonth() + 1);
    dosDate = dosDate << 5;
    dosDate = dosDate | date.getUTCDate();

    return (dosDate << 16) | dosTime;
};

/**
 * Create a worker to generate a zip file.
 * @param {JSZip} zip the JSZip instance at the right root level.
 * @param {Object} options to generate the zip file.
 * @param {String} comment the comment to use.
 */
exports.generateWorker = function (zip, options, comment) {

    var zipFileWorker = new ZipFileWorker(options.streamFiles, comment, options.platform, options.encodeFileName);
    var entriesCount = 0;
    try {

        zip.forEach(function (relativePath, file) {
            entriesCount++;
            var compression = getCompression(file.options.compression, options.compression);
            var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};
            var dir = file.dir, date = file.date;
            
            // Determine encryption for this file
            var password = file.options.password || options.password || null;
            var encryptionMethod = password ? (file.options.encryptionMethod || options.encryptionMethod || "traditional") : null;

            var worker = file._compressWorker(compression, compressionOptions);
            
            // Insert EncryptWorker if password is provided and file is not a directory
            if (password && !dir) {
                var EncryptWorker = require("../stream/EncryptWorker");
                
                // Convert date to DOS format for encryption header
                var dosDate = date ? dateToDOS(date) : dateToDOS(new Date());
                
                // Add encryption worker
                // Note: _compressWorker already includes a Crc32Probe, so crc32 is in streamInfo
                worker = worker.pipe(new EncryptWorker({
                    password: password,
                    method: encryptionMethod,
                    crc32: 0,  // Will be updated from streamInfo
                    dosDateRaw: dosDate,
                    bitFlag: 0  // Will be set by ZipFileWorker
                }));
            }
            
            worker.withStreamInfo("file", {
                name : relativePath,
                dir : dir,
                date : date,
                comment : file.comment || "",
                unixPermissions : file.unixPermissions,
                dosPermissions : file.dosPermissions,
                password : password,
                encryptionMethod : encryptionMethod
            })
            .pipe(zipFileWorker);
        });
        zipFileWorker.entriesCount = entriesCount;
    } catch (e) {
        zipFileWorker.error(e);
    }

    return zipFileWorker;
};
