"use strict";

module.exports = function(grunt) {
    var version = require("./package.json").version;

    grunt.initConfig({
        browserify: {
            all: {
                src: "lib/index.js",
                dest: "dist/jszip.js",
                options: {
                    browserifyOptions: {
                        standalone: "JSZip",
                        transform: ["package-json-versionify"],
                        insertGlobalVars: {
                            process: undefined,
                            Buffer: undefined,
                            __filename: undefined,
                            __dirname: undefined
                        },
                        builtins: false,
                        browserField: false
                    },
                    banner: grunt.file.read("lib/license_header.js").replace(/__VERSION__/, version)
                }
            }
        },
        uglify: {
            options: {
                mangle: true,
                preserveComments: false,
                banner: grunt.file.read("lib/license_header.js").replace(/__VERSION__/, version)
            },
            all: {
                src: "dist/jszip.js",
                dest: "dist/jszip.min.js"
            }
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-uglify");

    grunt.registerTask("build", ["browserify", "uglify"]);
    grunt.registerTask("default", ["build"]);
};
