/**
 * Copies the built SPA shell (build/index.html) to api/_shell.html so the
 * /znacky/:brand/:model server-renderer (api/stats.ts, type=page) can read it
 * from a location Vercel reliably bundles into the function via vercel.json
 * includeFiles. build/ is the static output dir and is not always traced into a
 * function, whereas files under api/ follow the proven _fonts pattern.
 *
 * Chained into `build` (runs after react-scripts build) rather than a postbuild
 * hook, so it fires regardless of the package manager's pre/post-script setting.
 * The copy is a build artifact and is git-ignored.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const src = join(root, 'build', 'index.html')
const dest = join(root, 'api', '_shell.html')

if (!existsSync(src)) {
	console.error(`copy-shell: ${src} not found — run after react-scripts build`)
	process.exit(1)
}
copyFileSync(src, dest)
console.log('copy-shell: wrote api/_shell.html from build/index.html')
