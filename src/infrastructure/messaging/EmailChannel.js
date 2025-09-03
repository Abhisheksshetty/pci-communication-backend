"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailChannel = void 0;
var nodemailer_1 = require("nodemailer");
var EmailChannel = /** @class */ (function () {
    function EmailChannel(config) {
        this.channelType = 'email';
        this.isConnected = false;
        this.config = config;
        this.initializeTransporter();
    }
    EmailChannel.prototype.initializeTransporter = function () {
        var _this = this;
        var _a;
        this.transporter = nodemailer_1.default.createTransporter({
            host: this.config.smtp.host,
            port: this.config.smtp.port,
            secure: this.config.smtp.secure,
            auth: this.config.smtp.auth,
            pool: true, // Use connection pool
            maxConnections: 5,
            maxMessages: 100,
            rateLimit: ((_a = this.config.rateLimit) === null || _a === void 0 ? void 0 : _a.maxPerMinute) || 50,
        });
        // Verify connection on startup
        this.transporter.verify(function (error, success) {
            if (error) {
                console.error('Email transporter verification failed:', error);
                _this.isConnected = false;
            }
            else {
                console.log('Email server is ready to send messages');
                _this.isConnected = true;
            }
        });
    };
    EmailChannel.prototype.send = function (recipient, message) {
        return __awaiter(this, void 0, void 0, function () {
            var deliveryStatus, mailOptions, result, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        deliveryStatus = {
                            messageId: message.id || this.generateMessageId(),
                            recipientId: recipient.id,
                            status: 'pending',
                            timestamp: new Date(),
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        if (!this.config.enabled) {
                            throw new Error('Email channel is disabled');
                        }
                        return [4 /*yield*/, this.validateRecipient(recipient)];
                    case 2:
                        if (!(_b.sent())) {
                            throw new Error('Invalid recipient email address');
                        }
                        // Check if recipient has email notifications enabled
                        if (((_a = recipient.preferences) === null || _a === void 0 ? void 0 : _a.email) === false) {
                            deliveryStatus.status = 'failed';
                            deliveryStatus.error = 'Recipient has disabled email notifications';
                            return [2 /*return*/, deliveryStatus];
                        }
                        mailOptions = this.buildMailOptions(recipient, message);
                        return [4 /*yield*/, this.transporter.sendMail(mailOptions)];
                    case 3:
                        result = _b.sent();
                        deliveryStatus.status = 'sent';
                        deliveryStatus.deliveredAt = new Date();
                        deliveryStatus.messageId = result.messageId || deliveryStatus.messageId;
                        console.log("Email sent successfully to ".concat(recipient.email), {
                            messageId: result.messageId,
                            response: result.response,
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        deliveryStatus.status = 'failed';
                        deliveryStatus.error = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        console.error("Failed to send email to ".concat(recipient.email, ":"), error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, deliveryStatus];
                }
            });
        });
    };
    EmailChannel.prototype.sendBulk = function (recipients, message) {
        return __awaiter(this, void 0, void 0, function () {
            var result, batchSize, batches, _i, batches_1, batch, promises;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        result = {
                            successful: [],
                            failed: [],
                            totalSent: 0,
                            totalFailed: 0,
                        };
                        batchSize = Math.min(((_a = this.config.rateLimit) === null || _a === void 0 ? void 0 : _a.maxPerMinute) || 50, 20);
                        batches = this.chunkArray(recipients, batchSize);
                        _i = 0, batches_1 = batches;
                        _b.label = 1;
                    case 1:
                        if (!(_i < batches_1.length)) return [3 /*break*/, 5];
                        batch = batches_1[_i];
                        promises = batch.map(function (recipient) { return __awaiter(_this, void 0, void 0, function () {
                            var status_1, error_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this.send(recipient, message)];
                                    case 1:
                                        status_1 = _a.sent();
                                        if (status_1.status === 'sent') {
                                            result.successful.push(recipient.id);
                                            result.totalSent++;
                                        }
                                        else {
                                            result.failed.push({
                                                recipientId: recipient.id,
                                                error: status_1.error || 'Failed to send',
                                            });
                                            result.totalFailed++;
                                        }
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_2 = _a.sent();
                                        result.failed.push({
                                            recipientId: recipient.id,
                                            error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                                        });
                                        result.totalFailed++;
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.allSettled(promises)];
                    case 2:
                        _b.sent();
                        if (!(batches.indexOf(batch) < batches.length - 1)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.delay(1000)];
                    case 3:
                        _b.sent(); // 1 second delay between batches
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/, result];
                }
            });
        });
    };
    EmailChannel.prototype.sendTemplate = function (recipient, templateId, variables) {
        return __awaiter(this, void 0, void 0, function () {
            var template, compiledMessage;
            var _a;
            return __generator(this, function (_b) {
                template = (_a = this.config.templates) === null || _a === void 0 ? void 0 : _a[templateId];
                if (!template) {
                    throw new Error("Template not found: ".concat(templateId));
                }
                compiledMessage = this.compileTemplate(template, variables);
                return [2 /*return*/, this.send(recipient, compiledMessage)];
            });
        });
    };
    EmailChannel.prototype.schedule = function (recipient, message, scheduleTime) {
        return __awaiter(this, void 0, void 0, function () {
            var jobId, delay;
            var _this = this;
            return __generator(this, function (_a) {
                jobId = this.generateJobId();
                delay = scheduleTime.getTime() - Date.now();
                if (delay <= 0) {
                    throw new Error('Schedule time must be in the future');
                }
                setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                    var error_3;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, this.send(recipient, message)];
                            case 1:
                                _a.sent();
                                console.log("Scheduled email sent to ".concat(recipient.email, " at ").concat(scheduleTime));
                                return [3 /*break*/, 3];
                            case 2:
                                error_3 = _a.sent();
                                console.error("Failed to send scheduled email:", error_3);
                                return [3 /*break*/, 3];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }, delay);
                console.log("Email scheduled for ".concat(recipient.email, " at ").concat(scheduleTime, " with job ID: ").concat(jobId));
                return [2 /*return*/, jobId];
            });
        });
    };
    EmailChannel.prototype.cancelScheduled = function (jobId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // This would integrate with a job queue to cancel scheduled jobs
                // For the setTimeout implementation, we can't cancel it easily
                console.log("Cancel scheduled email job: ".concat(jobId, " (not implemented for setTimeout)"));
                return [2 /*return*/, false];
            });
        });
    };
    EmailChannel.prototype.getDeliveryStatus = function (messageId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // This would query a database or external service for delivery status
                // For now, return empty array
                console.log("Get delivery status for message: ".concat(messageId));
                return [2 /*return*/, []];
            });
        });
    };
    EmailChannel.prototype.validateRecipient = function (recipient) {
        return __awaiter(this, void 0, void 0, function () {
            var emailRegex;
            return __generator(this, function (_a) {
                if (!recipient.email) {
                    return [2 /*return*/, false];
                }
                emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return [2 /*return*/, emailRegex.test(recipient.email)];
            });
        });
    };
    EmailChannel.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.transporter.verify()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_4 = _a.sent();
                        console.error('Email health check failed:', error_4);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EmailChannel.prototype.getConfig = function () {
        return __assign(__assign({}, this.config), { smtp: __assign(__assign({}, this.config.smtp), { auth: this.config.smtp.auth ? { user: this.config.smtp.auth.user } : undefined }) });
    };
    EmailChannel.prototype.updateConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.config = __assign(__assign({}, this.config), config);
                this.initializeTransporter();
                return [2 /*return*/];
            });
        });
    };
    EmailChannel.prototype.buildMailOptions = function (recipient, message) {
        var mailOptions = {
            from: "".concat(this.config.from.name, " <").concat(this.config.from.address, ">"),
            to: recipient.email,
            subject: message.title,
            html: this.buildHtmlContent(message),
            text: message.body || message.title,
        };
        if (this.config.replyTo) {
            mailOptions.replyTo = this.config.replyTo;
        }
        if (this.config.bcc && this.config.bcc.length > 0) {
            mailOptions.bcc = this.config.bcc;
        }
        // Add custom headers
        mailOptions.headers = __assign({ 'X-Message-Type': message.type, 'X-Priority': this.getPriorityHeader(message.priority) }, (message.id && { 'X-Message-ID': message.id }));
        return mailOptions;
    };
    EmailChannel.prototype.buildHtmlContent = function (message) {
        var html = "\n      <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">\n        <div style=\"background-color: #f8f9fa; padding: 20px; border-radius: 8px;\">\n          <h2 style=\"color: #333; margin: 0 0 16px 0;\">".concat(message.title, "</h2>\n    ");
        if (message.body) {
            html += "<p style=\"color: #666; line-height: 1.5; margin: 0 0 16px 0;\">".concat(message.body, "</p>");
        }
        if (message.actionUrl) {
            html += "\n        <div style=\"margin: 20px 0;\">\n          <a href=\"".concat(message.actionUrl, "\" \n             style=\"background-color: #007bff; color: white; padding: 12px 24px; \n                    text-decoration: none; border-radius: 4px; display: inline-block;\">\n            View Details\n          </a>\n        </div>\n      ");
        }
        if (message.imageUrl) {
            html += "<img src=\"".concat(message.imageUrl, "\" alt=\"\" style=\"max-width: 100%; height: auto; margin: 16px 0;\">");
        }
        html += "\n          <div style=\"margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;\">\n            <p style=\"color: #999; font-size: 12px; margin: 0;\">\n              This is an automated message from Sports Communication App.\n            </p>\n          </div>\n        </div>\n      </div>\n    ";
        return html;
    };
    EmailChannel.prototype.compileTemplate = function (template, variables) {
        var compiledTitle = template.title || template.subject || '';
        var compiledBody = template.body;
        // Simple template variable replacement
        Object.entries(variables).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            var placeholder = "{{".concat(key, "}}");
            compiledTitle = compiledTitle.replace(new RegExp(placeholder, 'g'), String(value));
            compiledBody = compiledBody.replace(new RegExp(placeholder, 'g'), String(value));
        });
        return {
            title: compiledTitle,
            body: compiledBody,
            type: template.type,
            priority: template.priority,
            category: template.category,
        };
    };
    EmailChannel.prototype.getPriorityHeader = function (priority) {
        switch (priority) {
            case 'urgent': return '1 (Highest)';
            case 'high': return '2 (High)';
            case 'normal': return '3 (Normal)';
            case 'low': return '4 (Low)';
            default: return '3 (Normal)';
        }
    };
    EmailChannel.prototype.generateMessageId = function () {
        return "email-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
    };
    EmailChannel.prototype.generateJobId = function () {
        return "job-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
    };
    EmailChannel.prototype.chunkArray = function (array, size) {
        var chunks = [];
        for (var i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };
    EmailChannel.prototype.delay = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    return EmailChannel;
}());
exports.EmailChannel = EmailChannel;
