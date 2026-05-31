// Launch Electron with a clean environment.
// The shell has ELECTRON_RUN_AS_NODE=1 set, which makes electron.exe behave as
// plain Node.js (require('electron') returns a path string instead of the API).
// We must strip it before spawning the real Electron GUI process.
const { spawn } = require('child_process')
const path = require('path')

const electronBin = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe')

const env = { ...process.env, NODE_ENV: 'development' }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronBin, [__dirname], { stdio: 'inherit', env })
child.on('close', (code) => process.exit(code ?? 0))
