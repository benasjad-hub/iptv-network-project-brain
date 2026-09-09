/**
 * `verify-install` — is the copied validator still the one this installation
 * was pinned to?
 *
 * READ-ONLY, OFFLINE, ZERO DEPENDENCIES. It runs INSIDE an installed Brain and
 * answers one question: does every file `INSTALL_MANIFEST.json` pins still hash
 * to the digest recorded at installation, and is there anything under `tools/`
 * that the manifest does not pin?
 *
 * WHY THE SECOND HALF MATTERS AS MUCH AS THE FIRST. An unpinned file under
 * `tools/` is either a local patch nobody recorded or a file from a different
 * source commit. Either way `source_commit` stops being a claim the tree
 * supports, and a portability guarantee that cannot be traced to a commit is a
 * sentence rather than a guarantee (`UPS-D-020`).
 *
 * IT IS NOT A SIGNATURE AND DOES NOT PRETEND TO BE. Anyone who can edit a file
 * can edit the digest beside it. It detects the failure that actually happens —
 * an accidental edit, a partial copy, a half-applied upgrade — not an adversary.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INSTALL_MANIFEST, verifyManifest } from './core.mjs'

/* The repository root, resolved from THIS MODULE'S OWN LOCATION and from
 * nothing else. No environment variable, no working directory, no configured
 * path: those are the three ways a check starts silently describing a different
 * tree than the one it lives in. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const manifestPath = path.join(ROOT, INSTALL_MANIFEST)
if (!fs.existsSync(manifestPath)) {
  console.error(`verify-install: ${INSTALL_MANIFEST} is missing.`)
  console.error('This repository does not record which Universal Project System commit its')
  console.error('validator came from, so nothing here can be traced. Fail closed.')
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
} catch (e) {
  console.error(`verify-install: ${INSTALL_MANIFEST} does not parse (${e.message}). Never hand-edit it.`)
  process.exit(1)
}

/* Everything actually under tools/, walked rather than assumed. Walking is what
 * finds the file the manifest does NOT mention; a loop over the manifest's own
 * keys could only ever find what it already knew about. */
const walk = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    /* A symlink is not followed and is not treated as its target. Following one
     * would hash a file outside this repository and report it as installed
     * content — the same containment rule the rest of the tooling applies. */
    if (entry.isSymbolicLink()) {
      acc.push({ path: path.relative(ROOT, abs), bytes: null, link: true })
    } else if (entry.isDirectory()) {
      walk(abs, acc)
    } else if (entry.isFile()) {
      acc.push({ path: path.relative(ROOT, abs), bytes: fs.readFileSync(abs) })
    }
  }
  return acc
}

const found = walk(path.join(ROOT, 'tools'))
const links = found.filter((f) => f.link)
const actual = found.filter((f) => !f.link)

const problems = verifyManifest(manifest, actual)
for (const l of links) {
  problems.push(`${l.path}: is a symbolic link — installed tooling must be a plain file inside this repository (UPS-D-020)`)
}

if (problems.length) {
  console.log(`FAIL  ${INSTALL_MANIFEST} does not describe this tree:`)
  for (const p of problems) console.log(`      · ${p}`)
  console.log('')
  console.log('The copied validator has drifted from the commit this installation names.')
  console.log('Do NOT edit the manifest to make this pass — the digests are worth something')
  console.log('precisely because nobody chose them. Restore the files, or re-install.')
  process.exit(1)
}

console.log(
  `PASS  verify-install: ${Object.keys(manifest.files).length} pinned file(s) match their digests; nothing under tools/ is unpinned`,
)
console.log(`      installed from ${manifest.source_repo} @ ${String(manifest.source_commit).slice(0, 12)} on ${manifest.installed_at}`)
console.log('      DETECTION, NOT A SIGNATURE. It catches an accidental edit, a partial copy or')
console.log('      a half-applied upgrade — not an adversary who can edit the manifest too.')
