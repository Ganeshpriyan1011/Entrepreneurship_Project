"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
// User model using simple JSON file storage
// See ../simple-storage.ts for UserService implementation
var simple_storage_1 = require("../simple-storage");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return simple_storage_1.UserService; } });
