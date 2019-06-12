import ProcessComponent from '../src/component';
import Processer from '../src/process';

export default class AgentComponent extends ProcessComponent {
  constructor(processer: Processer, args: { [name:string]: any }) {
    super(processer, args);
  }

  async componentWillCreate() {
    console.log('agent: in')
    // // throw new Error('xx')
  }

  async componentDidCreated() {
    console.log('agent: in2')
    // // throw new Error('xx2')
    // const fork = this.createWorkerForker('test/worker.js');
    // await this.createAgent('test', 'test/file.js');
    // await fork();
  }

  async componentWillDestroy() {
    console.log('agent: out');
  }

  async componentDidDestroyed() {
    console.log('agent: out2')
  }

  componentCatchError(err: Error) {
    console.log(err)
  }
}