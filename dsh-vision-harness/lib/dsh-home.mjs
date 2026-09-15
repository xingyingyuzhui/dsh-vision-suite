// @ts-check
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [home]
 */
export const defaultDshHome = (env = process.env, home = homedir()) => env.DSH_HOME || join(home, '.dsh')
