import Debug from 'debug'
import { EventEmitter } from 'events'
import type playwright from 'playwright-webkit'
import type { Browser, BrowserInstance } from './types'
import type { Automation } from '../automation'
import { WebkitAutomation } from './webkit-automation'

const debug = Debug('cypress:server:browsers:webkit')

let wkAutomation: WebkitAutomation | undefined

export async function connectToNewSpec (browser: Browser, options, automation: Automation) {
  if (!wkAutomation) throw new Error('connectToNewSpec called without wkAutomation')

  automation.use(wkAutomation)
  wkAutomation.automation = automation
  await options.onInitializeNewBrowserTab()
  await wkAutomation.reset(options.url)
}

export async function open (browser: Browser, url, options: any = {}, automation: Automation): Promise<BrowserInstance> {
  // resolve pw from user's project path
  const pwModulePath = require.resolve('playwright-webkit', { paths: [process.cwd()] })
  const pw = require(pwModulePath) as typeof playwright

  const pwBrowser = await pw.webkit.launch({
    proxy: {
      server: options.proxyServer,
    },
    downloadsPath: options.downloadsFolder,
    headless: browser.isHeadless,
  })

  wkAutomation = await WebkitAutomation.create(automation, pwBrowser, url)
  automation.use(wkAutomation)

  class WkInstance extends EventEmitter implements BrowserInstance {
    // TODO: how to obtain launched process PID from PW? this is used for process_profiler
    pid = NaN

    constructor () {
      super()

      pwBrowser.on('disconnected', () => {
        debug('pwBrowser disconnected')
        this.emit('exit')
      })
    }

    async kill () {
      debug('closing pwBrowser')
      await pwBrowser.close()
      wkAutomation = undefined
    }
  }

  return new WkInstance()
}
