"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.File = void 0;
// File model replaced with Azure Table Storage
// See ../storage.ts for FileService implementation
var storage_1 = require("../storage");
Object.defineProperty(exports, "File", { enumerable: true, get: function () { return storage_1.FileService; } });
