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
    grunt.loadNpmTasks("grunt-run");

    // 原有构建任务
    grunt.registerTask("build", ["browserify", "uglify"]);
    
    // 微信小程序专用构建任务
    grunt.registerTask("build:mp", "Build for WeChat MiniProgram", function() {
        const done = this.async();
        const { spawn } = require("child_process");
        
        console.log("Building JSZip for WeChat MiniProgram...");
        const rollup = spawn("npx", ["rollup", "-c", "rollup.config.js"], {
            stdio: "inherit"
        });
        
        rollup.on("close", function(code) {
            if (code === 0) {
                console.log("WeChat MiniProgram build completed!");
                done();
            } else {
                done(new Error("Rollup build failed with code " + code));
            }
        });
    });
    
    grunt.registerTask("default", ["build"]);
};
