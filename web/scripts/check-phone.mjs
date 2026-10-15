// Phone layout check (needs the app server on :8787 with the sample venues cached, and chromium). At 360 and 390 px
// with mobile emulation it fails if a page is wider than the screen, or if opening any <details> (evidence, research
// trail results) widens it, and saves a screenshot of each page to out/phone-*.png for a look.
// Note: under mobile emulation an overflowing page also widens `innerWidth`, so widths are compared with
// `documentElement.clientWidth`, which stays at the device width.
// usage: npm run check-phone [-- --base http://localhost:8787]
import { mkdirSync, writeFileSync } from 'node:fs'
import { browser, sleep } from './browser.mjs'

const args = process.argv.slice(2)
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:8787'
const OUT = new URL('../../out/', import.meta.url)
const WIDTHS = [360, 390]
const PAGES = ['/', '/?sample=0', '/?sample=1', '/?sample=2']

const PROBE = `
  const de = document.documentElement, W = de.clientWidth, problems = []
  const name = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').join('.') : '')
  const scrolls = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true } return false }
  const report = (why) => {
    problems.push(why + ': page is ' + de.scrollWidth + 'px wide')
    const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > W + 1 && !scrolls(e))
    for (const e of wide.filter((e) => !wide.includes(e.parentElement)).slice(0, 3)) problems.push('  wider than the screen: ' + name(e))
  }
  if (de.scrollWidth > W + 1) report('closed')
  for (const d of document.querySelectorAll('details')) {
    d.open = true; await sleep(60)
    if (de.scrollWidth > W + 1) { report('with "' + (d.querySelector('summary')?.textContent ?? '').trim().slice(0, 40) + '" open'); d.open = false; break }
    d.open = false
  }
  return problems`

mkdirSync(OUT, { recursive: true })
let failures = 0
for (const w of WIDTHS) {
  const b = await browser({ width: w, height: 800 })
  try {
    await b.send('Page.enable')
    for (const page of PAGES) {
      await b.send('Page.navigate', { url: BASE + page })
      await sleep(3000)
      const problems = await b.evaluate(PROBE)
      for (const p of problems) console.log(`${w}px ${page}: ${p}`)
      failures += problems.length
      const shot = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      writeFileSync(new URL(`phone-${w}-${page.replace(/\W+/g, '') || 'home'}.png`, OUT), Buffer.from(shot.result.data, 'base64'))
    }
  } finally {
    b.close()
  }
}
console.log(failures ? `\n${failures} phone layout problem(s)` : `phone layout ok: ${PAGES.length} pages at ${WIDTHS.join(', ')} px`)
process.exit(failures ? 1 : 0)
