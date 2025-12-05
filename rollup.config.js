"use strict";

const path = require("path");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const terser = require("@rollup/plugin-terser");
const replace = require("@rollup/plugin-replace");

const version = require("./package.json").version;
const banner = require("fs")
  .readFileSync(path.join(__dirname, "lib/license_header.js"), "utf8")
  .replace(/__VERSION__/g, version);

// 基础配置
const baseConfig = {
  input: "lib/index.js",
  output: {
    name: "JSZip",
    format: "umd",
    banner: banner,
    exports: "default"
  },
  plugins: [
    // 替换版本号
    replace({
      preventAssignment: true,
      values: {
        __VERSION__: JSON.stringify(version)
      }
    }),
    // 解析 node_modules 中的模块
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    // 转换 CommonJS 模块为 ES6
    commonjs({
      ignore: ["buffer", "process"]
    })
  ]
};

// 未压缩版本（用于微信小程序）
const devConfig = {
  ...baseConfig,
  output: {
    ...baseConfig.output,
    file: "dist/jszip.mp.js"
  }
};

// 压缩版本（用于微信小程序）
const prodConfig = {
  ...baseConfig,
  output: {
    ...baseConfig.output,
    file: "dist/jszip.mp.min.js"
  },
  plugins: [
    ...baseConfig.plugins,
    terser({
      format: {
        comments: /^!/,
        preamble: banner
      }
    })
  ]
};

module.exports = [devConfig, prodConfig];

