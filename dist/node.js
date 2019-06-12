"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emitter = require("events");
const utils_1 = require("./utils");
class Node extends emitter.EventEmitter {
    constructor(target, kind, name) {
        super();
        this._target = target;
        this._status = 0;
        this._kind = kind;
        this._name = name;
    }
    get pid() {
        switch (this._kind) {
            case utils_1.CHILD_PROCESS_TYPE.WORKER: return this._target.process.pid;
            case utils_1.CHILD_PROCESS_TYPE.AGENT: return this._target.pid;
        }
    }
    get killed() {
        switch (this._kind) {
            case utils_1.CHILD_PROCESS_TYPE.WORKER: return this._target.isDead();
            case utils_1.CHILD_PROCESS_TYPE.AGENT: return this._target.killed;
        }
    }
    set status(value) {
        this._status = value;
        this.emit('status', value);
    }
    get status() {
        return this._status;
    }
    onClose(app) {
        this._target.on('exit', (code) => {
            this.status = code ? 4 : 5;
            switch (this._kind) {
                case utils_1.CHILD_PROCESS_TYPE.WORKER:
                    const index = app.workers.indexOf(this);
                    if (index > -1) {
                        app.workers.splice(index, 1);
                        delete app.pids[this.pid];
                    }
                    break;
                case utils_1.CHILD_PROCESS_TYPE.AGENT:
                    for (const i in app.agents) {
                        if (app.agents[i] === this) {
                            delete app.agents[i];
                            delete app.pids[this.pid];
                        }
                    }
                    break;
                default: ;
            }
        });
    }
    onCreatedReceiveMessage(callback) {
        this._target.on('message', (message, socket) => callback(message, socket));
    }
    close() {
        this.status = 3;
        this._target.send('kill');
        this._target.kill('SIGTERM');
    }
    send(message, socket) {
        this._target.send(message, socket);
        return this;
    }
}
exports.default = Node;
