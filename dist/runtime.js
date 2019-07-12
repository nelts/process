"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const process_1 = require("./process");
const utils_1 = require("./utils");
const commandArgvParser = require("minimist");
const log4js_1 = require("log4js");
const loggerFilePath = path.resolve('logger.js');
if (fs.existsSync(loggerFilePath))
    log4js_1.configure(loggerFilePath);
const logger = log4js_1.getLogger();
logger.level = 'debug';
let args = {};
const argv = process.argv.slice(2);
if (!argv.length) {
    logger.error('process.argv need arguments');
    process.exit(1);
}
if (argv.length === 1 && argv[0].startsWith('{') && argv[0].endsWith('}')) {
    args = JSON.parse(argv[0]);
}
else {
    args = commandArgvParser(argv) || {};
}
if (args.script && !path.isAbsolute(args.script)) {
    args.script = path.resolve(process.cwd(), args.script);
}
args.kind = args.kind || utils_1.CHILD_PROCESS_TYPE.MASTER;
args.mpid = args.mpid || process.pid;
if (args.level)
    logger.level = args.level;
const errorHandler = (err) => {
    logger.error('[bootstrap error]:', err);
    sendToParent(utils_1.STATUS.BOOTSTRAP_FAILED);
    process.exit(1);
};
bindError(errorHandler);
const ModuleHandleFile = args.module || args.script;
if (!ModuleHandleFile)
    throw new Error('cannot find the argument of `module` or `script`');
const sandbox = require(ModuleHandleFile);
class Runtime {
    constructor() {
        this.processer = new process_1.default(logger, args.kind, args.mpid);
        this.processer.onExit((next) => this.destroy().then(next).catch(next));
        this.sandbox = new (sandbox.default || sandbox)(this.processer, args);
    }
    async create() {
        if (typeof this.sandbox.componentWillCreate === 'function')
            await this.sandbox.componentWillCreate();
        this.createMessager();
        unbindError(errorHandler);
        this.errorHandler = err => this.sandbox.componentCatchError && this.sandbox.componentCatchError(err);
        bindError(this.errorHandler);
        if (typeof this.sandbox.componentDidCreated === 'function')
            await this.sandbox.componentDidCreated();
    }
    async destroy() {
        if (typeof this.sandbox.componentWillDestroy === 'function')
            await this.sandbox.componentWillDestroy();
        process.off('message', this.messageHandler);
        delete this.sandbox.send;
        delete this.sandbox.kill;
        if (this.sandbox.createAgent)
            delete this.sandbox.createAgent;
        if (this.sandbox.createWorkerForker)
            delete this.sandbox.createWorkerForker;
        unbindError(this.errorHandler);
        const errorHandler = (err) => logger.error('[closing error]:', err);
        bindError(errorHandler);
        if (typeof this.sandbox.componentDidDestroyed === 'function')
            await this.sandbox.componentDidDestroyed();
    }
    async createMessager() {
        this.messageHandler = (message, socket) => {
            switch (message) {
                case 'kill':
                    this.processer.closingSelfStatus = 1;
                    break;
                default: this.sandbox.componentReceiveMessage && this.sandbox.componentReceiveMessage(message, socket);
            }
        };
        this.processer.onMessage(this.messageHandler);
        process.on('message', this.messageHandler);
    }
}
new Runtime()
    .create()
    .then(() => sendToParent(utils_1.STATUS.BOOTSTRAP_SUCCESS));
function bindError(callback) {
    ['error', 'unhandledRejection', 'uncaughtException'].forEach((name) => process.on(name, callback));
}
function unbindError(callback) {
    ['error', 'unhandledRejection', 'uncaughtException'].forEach((name) => process.off(name, callback));
}
function sendToParent(value, socket) {
    if (args.kind !== utils_1.CHILD_PROCESS_TYPE.MASTER) {
        process.send(value, socket);
    }
}
