const debug = require("debug")("faktory-worker");
const assert = require("assert");

import Client from "./client";
import Worker from './worker';
import { JobType, Registry, MiddlewareFunction, JobFunction } from "./types";

export type FaktoryControlCreator = {
  (): FaktoryControl;
};

export interface FaktoryControl {
  registry: Registry;
  use(fn: MiddlewareFunction): FaktoryControl;
  middleware: MiddlewareFunction[];
  register(name: JobType, fn: JobFunction): FaktoryControl;
  connect(...arg0: any[]): Promise<Client>;
  work(options: WorkerOptions): Promise<Worker>;
  stop(): Promise<any>;
};

/**
 * creates faktory singletons
 *
 * @module faktory
 * @private
 * @return {FaktoryControl}
 */
const faktory = (): FaktoryControl => {
  const middleware: MiddlewareFunction[] = [];
  const registry: Registry = {};
  let worker: Worker | undefined;

  /**
   *
   * A singleton holds most of the methods you'll need to get started registering jobs,
   * connecting to the server, pushing jobs, or starting a worker. Only use this is you'd like to
   * create multiple faktory instances in one process (testing).
   *
   * @private
   */
  return {
    /**
     * Returns the registry for the faktory singleton
     *
     * @private
     * @instance
     * @return {Registry}
     */
    get registry(): Registry {
      return registry;
    },

    /**
     * Returns the middleware stack for the faktory singleton
     *
     * @private
     * @instance
     * @return {Middleware} array of middleware functions with koa-compose-style signatures
     */
    get middleware(): MiddlewareFunction[] {
      return middleware;
    },

    /**
     * Adds a middleware function to the stack
     *
     * @param  {Function} fn koa-compose-style middleware function
     * @return {FaktoryControl}      this
     * @instance
     * @see  {@link https://github.com/koajs/koa/blob/master/docs/guide.md#writing-middleware|koa middleware}
     * @example
     * faktory.use(async (ctx, next) => {
     *   // a pool you created to hold database connections
     *   pool.use(async (conn) => {
     *     ctx.db = conn;
     *     await next();
     *   });
     * });
     */
    use(fn: MiddlewareFunction): FaktoryControl {
      assert(typeof fn === "function");
      debug("use %s", fn._name || fn.name || "-");
      middleware.push(fn);
      return this;
    },

    /**
     * Adds a {@link external:JobFunction|JobFunction} to the {@link Registry}
     *
     * @param  {external:Jobtype}   name string descriptor for the jobtype
     * @param  {external:JobFunction} fn
     * @return {FaktoryControl}        this
     * @instance
     * @example
     * faktory.register('MyJob', (...args) => {
     *   // some work
     * });
     */
    register(name: JobType, fn: JobFunction): FaktoryControl {
      assert(typeof fn === "function", "a registered job must be a function");
      debug("registered %s", name);
      registry[name] = fn;
      return this;
    },

    /**
     * Creates a new {@link Client}
     *
     * @param  {...*} args args forwarded to {@link Client}
     * @return {Client}
     * @instance
     * @example
     * const client = await faktory.connect();
     *
     * await client.push(job);
     */
    connect(...args: any[]): Promise<Client> {
      return new Client(...args).connect();
    },

    /**
     * Starts a worker. Doesn't resolve until the worker is shut down. Only call this
     * once per-process.
     *
     * @param  {object} options options to {@link Worker}
     * @return {Promise}         the {@link Worker.work} promise
     * @instance
     * @example
     * // this keeps the process open and can be `await`ed
     * faktory.work();
     */
    work(options: WorkerOptions = {}): Promise<Worker> {
      if (worker) throw new Error("can only call .work once per singleton");
      worker = new Worker(Object.assign({}, options, { registry, middleware }));
      return worker.work();
    },

    /**
     * Stops the worker previously started.
     *
     * @return {promise} promise returned by {@link Worker.stop}
     * @instance
     * @example
     * // previously
     * faktory.work();
     *
     * faktory.stop();
     */
    stop(): Promise<any> {
      if (worker) {
        const existing: Worker = worker;
        worker = undefined;
        if (existing) return existing.stop();
      }
      return Promise.resolve();
    },
  };
};

// export type FaktoryControlCreator = FaktoryControl | FaktoryControlFactory;
export default Object.assign(faktory, faktory(), { Client, Worker });