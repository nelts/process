import Processer from './process';
export default class ProcessComponent {
    processer: Processer;
    private arguments;
    constructor(processer: Processer, args: {
        [name: string]: any;
    });
    kill(pid?: number): void;
    send(message: any, socket: any): void;
    createAgent(name: string, file: string, _args?: any): Promise<unknown>;
    createWorkerForker(file: string, _args?: any): () => Promise<unknown>;
}
