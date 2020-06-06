const encode = require('./encode');
import { JobType } from './types';
import Client from './client';

const MUTATE = 'MUTATE';

/**
 * commands
 * @private
 */
enum Verb {
  CLEAR = 'clear',
  KILL = 'kill',
  DISCARD = 'discard',
  REQUEUE = 'requeue',
}

/**
 * targets
 * @private
 */
enum Target {
  RETRIES = 'retries',
  SCHEDULED = 'scheduled',
  DEAD = 'dead',
}

export const SCHEDULED = Target.SCHEDULED;
export const RETRIES = Target.RETRIES;
export const DEAD = Target.DEAD;

export type Filter = {
  jobtype?: JobType;
  pattern?: string;
  jids?: Array<string>;
  regexp?: string;
}

/**
 * A wrapper for the [Mutate API](https://github.com/contribsys/faktory/wiki/Mutate-API)
 *
 * A low-level data management API to script certain repairs or migrations.
 *
 * !!! Please be warned: MUTATE commands can be slow and/or resource intensive.
 * **They should not be used as part of your application logic.**
 */
class Mutation {
  client: Client;
  target: Target;
  filter: Filter;
  cmd: Verb;

  /**
   * @param {Client} client
   */
  constructor(client: Client) {
    this.client = client;
    this.filter = {};
  }

  /**
   * Filters the affected jobs by a jobtype string.
   * Use this to ensure you're only affecting a single jobtype if applicable.
   * Can be chained.
   *
   * Note: jobtype and other filters do not apply for the *clear* command.
   *
   * @param {string} type jobtype fiter for operation
   * @example
   * client.dead.ofType('SendEmail').discard();
   */
  ofType(jobtype: JobType) {
    if (typeof jobtype !== 'string') {
      throw new Error('jobtype given to ofType must be a string');
    }
    this.filter.jobtype = jobtype;
    return this;
  }

  /**
   * Filters the affected jobs by one or more job ids. This is much more
   * efficient when only one jid is provided. Can be chained.
   *
   * Note: jobtype and other filters do not apply for the *clear* command.
   *
   * @param  {...string} jids job ids to target for the operation
   * @example
   * await client.retries.withJids('1234').requeue();
   */
  withJids(...jids: Array<string>) {
    const ids = Array.isArray(jids[0]) ? jids[0] : jids;
    this.filter.jids = ids;
    return this;
  }

  /**
   * Filters the MUTATE selection to jobs matching a Redis SCAN pattern.
   * Can be chained.
   *
   * Note the regexp filter scans the entire job payload and can be tricky to
   * get right, for instance you'll probably need * on both sides. The regexp
   * filter option is passed to Redis's SCAN command directly, read the SCAN
   * documentation for further details.
   * https://redis.io/commands/scan
   *
   * @param {string} pattern redis SCAN pattern to target jobs for the operation
   * @example
   * await client.retries.matching("*uid:12345*").kill();
   */
  matching(pattern: string) {
    if (typeof pattern !== 'string') {
      throw new Error(`
Argument given to matching() must be a redis SCAN compatible pattern string,
other object types cannot be translated.
See the Redis SCAN documentation for pattern matching examples.
https://redis.io/commands/scan
      `.trim());
    }
    this.filter.regexp = pattern;
    return this;
  }

  /**
   * @private
   */
  toJSON() {
    const { cmd, target, filter } = this;
    return { cmd, target, filter };
  }

  /**
   * Executes a *clear* mutation. This clears the
   * set entirely **and any filtering added does not apply**.
   */
  clear() {
    this.cmd = Verb.CLEAR;
    return this.send();
  }

  /**
   * Executes a *kill* mutation. Jobs that are killed are sent to the dead set.
   */
  kill() {
    this.cmd = Verb.KILL;
    return this.send();
  }

  /**
   * Executes a *discard* mutation. Jobs that are discarded are permanently deleted.
   */
  discard() {
    this.cmd = Verb.DISCARD;
    return this.send();
  }

  /**
   * Executes a *requeue* mutation. Jobs that are requeued are sent back to their
   * original queue for processing.
   */
  requeue() {
    this.cmd = Verb.REQUEUE;
    return this.send();
  }

  /**
   * @private
   */
  send() {
    return this.client.sendWithAssert(
      [MUTATE, encode(this.toJSON())],
      "OK"
    );
  }
}

export default Mutation;