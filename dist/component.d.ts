import Processer from './process';
import { ProcessArgvType } from './index';
import { EventEmitter } from '@nelts/utils';
export default class ProcessComponent extends EventEmitter {
    processer: Processer;
    private arguments;
    constructor(processer: Processer, args: ProcessArgvType);
    readonly kind: any;
    readonly isWorker: boolean;
    readonly isMaster: boolean;
    readonly isAgent: boolean;
    kill(pid?: number): void;
    send(message: any, socket: any): void;
    createAgent(name: string, file: string, _args?: any): Promise<unknown>;
    createWorkerForker(file: string, _args?: any): () => Promise<import("./node").default>;
}
