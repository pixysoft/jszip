# ZIP 加密功能修复总结

## 问题概述

JSZip 原有的加密实现存在两个关键bug，导致：
1. **无法正确解密标准ZIP工具（如zip/unzip）创建的加密文件**
2. **创建的加密文件无法被标准ZIP工具正确解密**

## 根本原因分析

### Bug #1: 密码验证字节计算错误

**问题：** ZIP加密使用一个特殊的验证字节来检查密码是否正确。这个字节应该从**原始DOS时间格式**（32位整数）中提取，但原代码错误地使用了**JavaScript时间戳**（毫秒数）。

#### 对比 adm-zip（正确实现）

```javascript
// adm-zip: 保留原始DOS时间值
_time = data.readUInt32LE(Constants.LOCTIM);  // 32位DOS时间

// 验证时使用
const verifyByte = (header.flags & 0x8) === 0x8 
    ? header.timeHighByte    // DOS时间高字节: (_time >>> 8) & 0xFF
    : header.crc >>> 24;
```

#### 原JSZip实现（错误）

```javascript
// 原代码: 将DOS时间转换成Date对象，丢失原始值
this.date = reader.readDate();  // 返回 JavaScript Date 对象

// 后续使用
lastModTime: this.date.getTime()  // 获取毫秒时间戳（如：1733443200000）

// 验证时
var timeCheck = (this.lastModTime >>> 8) & 0xFF;  // 从巨大的毫秒数提取，完全错误！
```

**DOS时间格式** (32位):
```
Bits 0-4:   秒/2
Bits 5-10:  分钟  
Bits 11-15: 小时
Bits 16-20: 日
Bits 21-24: 月
Bits 25-31: 年-1980
```

提取 `(dosTime >>> 8) & 0xFF` 得到的是 **bits 8-15**（包含小时和部分分钟）。

### Bug #2: 加密密钥更新算法错误

**问题：** 加密算法中的密钥更新函数使用了不正确的整数乘法运算。

#### 对比 adm-zip（正确实现）

```javascript
// adm-zip: 使用 Math.imul (32位整数乘法)
const uMul = (a, b) => Math.imul(a, b) >>> 0;

Initkeys.prototype.updateKeys = function (byteValue) {
    const keys = this.keys;
    keys[0] = crc32update(keys[0], byteValue);
    keys[1] += keys[0] & 0xff;                    // 步骤1: 加法
    keys[1] = uMul(keys[1], 134775813) + 1;      // 步骤2: 32位整数乘法
    keys[2] = crc32update(keys[2], keys[1] >>> 24);
    return byteValue;
};
```

#### 原JSZip实现（错误）

```javascript
// 原代码: 一行完成，但普通乘法可能溢出
updateKeys: function(byte) {
    this.keys[0] = encryptionUtils.updateCRC32(this.keys[0], byte);
    this.keys[1] = (((this.keys[1] + (this.keys[0] & 0xFF)) >>> 0) * 134775813 + 1) >>> 0;
    //                                                          ^^^ 普通乘法，不保证32位整数语义
    this.keys[2] = encryptionUtils.updateCRC32(this.keys[2], (this.keys[1] >>> 24) & 0xFF);
}
```

**关键差异：** JavaScript的普通 `*` 运算符使用IEEE 754双精度浮点数，而 `Math.imul()` 保证32位整数乘法语义，这对于ZIP加密算法的正确性至关重要。

## 修复方案

### 修复1: 保留原始DOS时间值

**文件:** `lib/reader/DataReader.js`, `lib/zipEntry.js`

```javascript
// 1. 添加读取原始DOS时间的方法
readDOSDate: function() {
    return this.readInt(4);  // 返回原始32位整数
}

// 2. 在zipEntry中保存原始值
readCentralPart: function(reader) {
    // ...
    this.dosDateRaw = reader.readDOSDate();      // 保存原始DOS时间
    this.date = this.dosDateToJSDate(this.dosDateRaw);  // 转换供显示
    // ...
}

// 3. 传递给加密/解密worker
encryptionInfo = {
    method: method,
    crc32: this.crc32,
    dosDateRaw: this.dosDateRaw,  // 传递原始DOS时间
    bitFlag: this.bitFlag
};
```

**文件:** `lib/stream/DecryptWorker.js`

```javascript
// 使用正确的验证逻辑（参照adm-zip）
DecryptWorker.prototype.processHeader = function (data) {
    // ...
    var checkByte = header[11];  // 解密后的验证字节
    var verifyByte;
    
    // 根据bit 3判断使用哪个验证方法
    if ((this.bitFlag & 0x08) === 0x08) {
        // Bit 3置位: 使用DOS时间高字节
        verifyByte = (this.dosDateRaw >>> 8) & 0xFF;
    } else {
        // Bit 3未置位: 使用CRC32高字节 (PKZIP 2.0+标准)
        verifyByte = ((this.crc32 >>> 0) >>> 24) & 0xFF;
    }
    
    var valid = (checkByte === verifyByte);
    // ...
};
```

### 修复2: 使用正确的整数乘法

**文件:** `lib/encryption/traditional.js`

```javascript
// 修改前
updateKeys: function(byte) {
    this.keys[0] = encryptionUtils.updateCRC32(this.keys[0], byte);
    this.keys[1] = (((this.keys[1] + (this.keys[0] & 0xFF)) >>> 0) * 134775813 + 1) >>> 0;
    this.keys[2] = encryptionUtils.updateCRC32(this.keys[2], (this.keys[1] >>> 24) & 0xFF);
}

// 修改后
updateKeys: function(byte) {
    this.keys[0] = encryptionUtils.updateCRC32(this.keys[0], byte);
    this.keys[1] = (this.keys[1] + (this.keys[0] & 0xFF)) >>> 0;      // 步骤1
    this.keys[1] = (Math.imul(this.keys[1], 134775813) + 1) >>> 0;   // 步骤2: 使用Math.imul
    this.keys[2] = encryptionUtils.updateCRC32(this.keys[2], (this.keys[1] >>> 24) & 0xFF);
}
```

### 修复3: 加密时正确传递DOS时间

**文件:** `lib/generate/index.js`

```javascript
// 添加DOS时间转换函数
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

// 使用DOS时间创建EncryptWorker
var dosDate = date ? dateToDOS(date) : dateToDOS(new Date());
worker = worker.pipe(new EncryptWorker({
    password: password,
    method: encryptionMethod,
    crc32: 0,
    dosDateRaw: dosDate,  // 传递DOS格式时间
    bitFlag: 0
}));
```

## 测试结果

### 测试环境
- Node.js v18+
- 系统自带的 `zip` 和 `unzip` 命令

### 兼容性测试

创建了 `test/compatibility_test.js` 测试三种场景：

1. **测试1**: `zip` 命令加密 → JSZip 解密 ✅
2. **测试2**: JSZip 加密 → `unzip` 命令解密 ✅  
3. **测试3**: JSZip 加密 → JSZip 解密 ✅

### 实际文件测试

成功解密了实际的加密ZIP文件 `382-执信桥_byJMQZ2.io`：
- 文件数: 7个
- 加密方式: Traditional (PKZIP 2.0)
- 密码: soho0909
- 所有文件解密成功 ✅

## 影响范围

### 修改的文件
1. `lib/reader/DataReader.js` - 添加 readDOSDate 方法
2. `lib/zipEntry.js` - 保存原始DOS时间，添加转换函数
3. `lib/compressedObject.js` - 传递DOS时间和bit flags
4. `lib/stream/DecryptWorker.js` - 修复密码验证逻辑
5. `lib/stream/EncryptWorker.js` - 更新参数
6. `lib/encryption/traditional.js` - 修复密钥更新算法
7. `lib/generate/index.js` - 添加DOS时间转换，修复CRC32处理

### 向后兼容性
- ✅ 不影响未加密ZIP文件的读写
- ✅ 不影响现有API
- ✅ 所有现有测试通过

## 技术参考

本次修复严格参照：
1. **adm-zip** - 已验证可正确处理加密ZIP的Node.js库
2. **APPNOTE.TXT** - PKWare官方ZIP文件格式规范
3. **PKZIP 2.0 Traditional Encryption** - 加密算法标准

## 总结

通过以上修复，JSZip现在能够：
1. ✅ 正确解密由标准ZIP工具创建的加密文件
2. ✅ 创建可被标准ZIP工具正确解密的加密文件
3. ✅ 完全兼容PKZIP 2.0 Traditional加密标准
4. ✅ 与zip/unzip命令完全互操作

修复日期: 2024-12-06

