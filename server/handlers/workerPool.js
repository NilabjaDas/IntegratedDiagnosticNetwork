// File: workerPool.js
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class WorkerPool {
  constructor(options = {}) {
    const size = Number(options.size || Math.max(1, (os.cpus().length || 4) - 1));
    const workerFile = options.workerFile || path.resolve(__dirname, 'analyticsWorker.js');
    this.size = size;
    this.workerFile = workerFile;
    this.workers = [];
    this.idle = [];
    this.queue = [];
    for (let i = 0; i < this.size; i++) this._createWorker();
  }

  _createWorker() {
    const w = new Worker(this.workerFile);
    w._tasks = new Map();
    w.on('message', (msg) => {
      const { taskId, result, error } = msg || {};
      const t = w._tasks.get(taskId);
      if (t) {
        if (error) t.reject(new Error(error));
        else t.resolve(result);
        w._tasks.delete(taskId);
      }
      if (!this.idle.includes(w)) this.idle.push(w);
      this._drain();
    });
    w.on('error', (err) => {
      for (const [taskId, t] of w._tasks) t.reject(err);
      w._tasks.clear();
      this._replaceWorker(w);
    });
    w.on('exit', (code) => {
      for (const [taskId, t] of w._tasks) t.reject(new Error('worker exit'));
      w._tasks.clear();
      this._replaceWorker(w);
    });
    this.workers.push(w);
    this.idle.push(w);
  }

  _replaceWorker(old) {
    this.workers = this.workers.filter(w => w !== old);
    this.idle = this.idle.filter(w => w !== old);
    try { old.terminate(); } catch (e) {}
    this._createWorker();
  }

  _drain() {
    while (this.queue.length && this.idle.length) {
      const w = this.idle.shift();
      const item = this.queue.shift();
      w._tasks.set(item.taskId, { resolve: item.resolve, reject: item.reject, timer: item.timer });
      w.postMessage(item.payload);
    }
  }

  runTask(payload, opts = {}) {
    const timeout = Number(opts.timeout || 10000);
    const taskId = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('task timeout'));
      }, timeout);
      const wrappedResolve = (res) => { clearTimeout(timer); resolve(res); };
      const wrappedReject = (err) => { clearTimeout(timer); reject(err); };
      const item = { payload: Object.assign({ taskId }, payload), taskId, resolve: wrappedResolve, reject: wrappedReject, timer };
      if (this.idle.length) {
        const w = this.idle.shift();
        w._tasks.set(taskId, { resolve: wrappedResolve, reject: wrappedReject, timer });
        w.postMessage(item.payload);
      } else {
        this.queue.push(item);
      }
    });
  }

  destroy() {
    for (const w of this.workers) {
      try { w.terminate(); } catch (e) {}
    }
    this.workers = [];
    this.idle = [];
    this.queue = [];
  }
}

module.exports = WorkerPool;
