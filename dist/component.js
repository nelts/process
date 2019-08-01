"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const utils_2 = require("@nelts/utils");
class ProcessComponent extends utils_2.EventEmitter {
    constructor(processer, args) {
        super();
        this.processer = processer;
        this.arguments = args;
    }
    get kind() {
        return this.arguments.kind;
    }
    get isWorker() {
        return this.kind === utils_1.CHILD_PROCESS_TYPE.WORKER;
    }
    get isMaster() {
        return this.kind === utils_1.CHILD_PROCESS_TYPE.MASTER;
    }
    get isAgent() {
        return this.kind === utils_1.CHILD_PROCESS_TYPE.AGENT;
    }
    kill(pid = 0) {
        return this.processer.kill(pid);
    }
    send(message, socket) {
        const options = {
            message,
            from: process.pid
        };
        if (this.arguments.kind !== utils_1.CHILD_PROCESS_TYPE.MASTER) {
            process.send(options, socket);
        }
    }
    createAgent(name, file, _args) {
        if (this.arguments.kind === utils_1.CHILD_PROCESS_TYPE.WORKER)
            return;
        return this.processer.createAgent(this.arguments.cwd || process.cwd(), name, file, _args);
    }
    createWorkerForker(file, _args) {
        if (this.arguments.kind === utils_1.CHILD_PROCESS_TYPE.WORKER)
            return;
        return this.processer.createWorkerForker(this.arguments.cwd || process.cwd(), 'worker', file, _args);
    }
}
exports.default = ProcessComponent;
