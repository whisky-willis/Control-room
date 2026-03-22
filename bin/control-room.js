#!/usr/bin/env node
'use strict'

const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const packageDir = path.resolve(__dirname, '..')
const userDir = process.cwd()
const args = process.argv.slice(2)

// Allow: control-room [path]  e.g. control-room ~/my-project
const scanTarget = args[0] ? path.resolve(args[0]) : userDir

console.log(`
  ██████╗ ██████╗ ███╗   ██╗████████╗██████╗  ██████╗ ██╗
 ██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██║
 ██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝██║   ██║██║
 ██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║
 ╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║╚██████╔╝███████╗
  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
  ROOM     — Workday for AI Agents
`)

console.log(`📂 Scanning: ${scanTarget}\n`)

// Install dependencies if node_modules is missing
if (!fs.existsSync(path.join(packageDir, 'node_modules'))) {
  console.log('📦 Installing dependencies (first run)...')
  execSync('npm install', { cwd: packageDir, stdio: 'inherit' })
}

// Write a config pointing at the user's directory
// If the user has their own control-room.config.json, merge it
const userConfig = path.join(scanTarget, 'control-room.config.json')
const packageConfig = path.join(packageDir, 'control-room.config.json')

let config = {
  scanPaths: [scanTarget],
  defaultModel: 'claude-sonnet-4-6',
  workflows: [],
}

if (fs.existsSync(userConfig)) {
  try {
    const existing = JSON.parse(fs.readFileSync(userConfig, 'utf8'))
    // Resolve any relative scanPaths against the user's directory
    const resolvedPaths = (existing.scanPaths || ['.']).map((p) =>
      path.isAbsolute(p) ? p : path.resolve(scanTarget, p)
    )
    config = { ...existing, scanPaths: resolvedPaths }
    console.log(`✅ Loaded config from ${userConfig}`)
  } catch {
    console.warn(`⚠️  Could not parse control-room.config.json — using defaults`)
  }
}

fs.writeFileSync(packageConfig, JSON.stringify(config, null, 2))

// Run the scanner
console.log('🔍 Discovering agents...\n')
try {
  execSync('npx tsx scripts/scan-agents.ts', { cwd: packageDir, stdio: 'inherit' })
} catch {
  console.error('❌ Scanner failed. Check the output above.')
  process.exit(1)
}

// Start the dev server
console.log('\n🚀 Starting Control Room...\n')
const next = spawn(
  'npx',
  ['next', 'dev', '--port', process.env.PORT || '3000'],
  {
    cwd: packageDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  }
)

next.on('close', (code) => process.exit(code ?? 0))

// Open browser after a short delay
setTimeout(() => {
  const port = process.env.PORT || '3000'
  const url = `http://localhost:${port}`
  console.log(`\n  ✨ Control Room running at ${url}\n`)
  const open =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open'
  try {
    execSync(`${open} ${url}`)
  } catch {
    // Browser open is best-effort
  }
}, 4000)
