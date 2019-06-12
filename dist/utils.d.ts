/// <reference types="node" />
import { ChildProcess } from "child_process";
import { Worker } from 'cluster';
import Node from './node';
export declare enum STATUS {
    BOOTSTRAPING = 0,
    BOOTSTRAP_FAILED = 1,
    BOOTSTRAP_SUCCESS = 2,
    CLOSING = 3,
    CLOSE_FAILED = 4,
    CLOSE_SUCCESS = 5
}
export declare enum CHILD_PROCESS_TYPE {
    MASTER = 0,
    WORKER = 1,
    AGENT = 2
}
export declare function safeClose(callback: Function): void;
export interface AGENT extends ChildProcess {
    node?: Node;
}
export interface WORKER extends Worker {
    node?: Node;
}
