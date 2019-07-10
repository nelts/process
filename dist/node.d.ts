/// <reference types="node" />
import * as emitter from 'events';
import { CHILD_PROCESS_TYPE, STATUS, AGENT, WORKER } from './utils';
import Processer from './process';
export default class Node extends emitter.EventEmitter {
    private _target;
    private _status;
    private _kind;
    private _name;
    constructor(target: AGENT | WORKER, kind: CHILD_PROCESS_TYPE, name: string);
    readonly name: string;
    readonly pid: number;
    readonly killed: boolean;
    status: STATUS;
    onClose(app: Processer): void;
    onCreatedReceiveMessage(callback: Function): void;
    close(): void;
    send(message: any, socket?: any): Node;
}
