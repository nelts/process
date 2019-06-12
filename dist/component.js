"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
class ProcessComponent {
    constructor(processer, args) {
        this.processer = processer;
        this.arguments = args;
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
