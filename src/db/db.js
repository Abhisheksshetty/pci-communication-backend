"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var postgres_js_1 = require("drizzle-orm/postgres-js");
var postgres_1 = require("postgres");
var config_js_1 = require("../config/config.js");
var dsl;
var db = function () {
    if (!dsl) {
        var connection = (0, postgres_1.default)((0, config_js_1.default)().DB_URL);
        dsl = (0, postgres_js_1.drizzle)(connection);
    }
    return dsl;
};
exports.default = db;
