// Launch Electron with a clean environment (no console window).
// Strips ELECTRON_RUN_AS_NODE so electron.exe runs as GUI, not Node.
const { spawn } = require('child_process')
const path = require('path')

const electronBin = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe')

const env = { ...process.env, NODE_ENV: 'development' }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronBin, [__dirname], { stdio: 'inherit', env })
child.on('close', (code) => process.exit(code ?? 0))
