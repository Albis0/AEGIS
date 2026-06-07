// Vite + Electron'u gizli başlatır — terminal penceresi açılmaz.
const { spawn } = require('child_process')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const bun = 'bun'

const vite = spawn(bun, ['run', 'dev:vite'], {
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
    env,
})

const waitOn = require('wait-on')
waitOn({ resources: ['tcp:127.0.0.1:5173'], timeout: 30000 }, (err) => {
    if (err) { console.error('Vite başlamadı:', err); process.exit(1); }

    const electron = spawn(bun, ['run', 'dev:electron'], {
        stdio: 'ignore',
        shell: false,
        windowsHide: true,
        env,
    })

    electron.on('close', () => {
        vite.kill()
        process.exit(0)
    })
})

process.on('SIGINT', () => { vite.kill(); process.exit(0) })
process.on('SIGTERM', () => { vite.kill(); process.exit(0) })
