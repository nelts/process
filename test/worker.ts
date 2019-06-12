import ProcessComponent from '../src/component';
import Processer from '../src/process';

export default class WorkerComponent extends ProcessComponent {
  constructor(processer: Processer, args: { [name:string]: any }) {
    super(processer, args);
  }

  async componentWillCreate() {
    console.log('worker: in')
    // // throw new Error('xx')
  }

  async componentDidCreated() {
    console.log('worker: in2')
    // // throw new Error('xx2')
    // const fork = this.createWorkerForker('test/worker.js');
    // await this.createAgent('test', 'test/file.js');
    // await fork();
  }

  async componentWillDestroy() {
    console.log('worker: out');
  }

  async componentDidDestroyed() {
    console.log('worker: out2')
  }

  componentCatchError(err: Error) {
    console.log(err)
  }
}