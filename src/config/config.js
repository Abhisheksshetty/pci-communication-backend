"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var config = function () {
    return {
        PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
        DB_URL: process.env.DB_URL ? process.env.DB_URL : "value_not_provided",
    };
};
exports.default = config;
