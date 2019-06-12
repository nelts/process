import ProcessComponent from '../src/component';
import Processer from '../src/process';

export default class IndexComponent extends ProcessComponent {
  constructor(processer: Processer, args: { [name:string]: any }) {
    super(processer, args);
  }

  async componentWillCreate() {
    console.log('index: in')
    // // throw new Error('xx')
  }

  async componentDidCreated() {
    console.log('index: in2')
    // // throw new Error('xx2')
    const fork = this.createWorkerForker('test/worker.ts');
    await this.createAgent('test', 'test/file.ts');
    await fork();
  }

  async componentWillDestroy() {
    console.log('index: out');
  }

  async componentDidDestroyed() {
    console.log('index: out2')
  }

  componentCatchError(err: Error) {
    console.log(err)
  }
}