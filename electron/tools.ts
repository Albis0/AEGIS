// Jarvis tools: things the assistant can actually DO on the PC.
// Each tool = an OpenAI/Groq-style schema + an async executor.
// No API key needed for these (file + shell + open). Web search is gated on TAVILY_API_KEY.

const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

type ToolResult = string

// Resolve ~ and make paths absolute relative to the user's home for convenience.
function resolvePath(p: string): string {
  if (!p) return os.homedir()
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(1))
  }
  return path.isAbsolute(p) ? p : path.join(os.homedir(), p)
}

function run(cmd: string, timeoutMs = 30000): Promise<ToolResult> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (err: any, stdout: string, stderr: string) => {
      const out = (stdout || '').trim()
      const errOut = (stderr || '').trim()
      if (err && !out) {
        resolve(`HATA: ${err.message}${errOut ? '\n' + errOut : ''}`)
      } else {
        resolve(out || errOut || '(çıktı yok, komut çalıştı)')
      }
    })
  })
}

// ---- Tool schemas sent to Groq ----
const toolSchemas = [
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Windows PowerShell komutu çalıştır. Sistem bilgisi, uygulama açma, dosya işlemleri, hesaplama gibi her şey için kullanılabilir. Tehlikeli/yıkıcı komutlardan kaçın.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Çalıştırılacak PowerShell komutu' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Bir uygulamayı, dosyayı, klasörü veya URL\'yi varsayılan programla aç (Windows start). Örn: "notepad", "chrome", "https://youtube.com", "C:/Users".',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Açılacak uygulama adı, dosya yolu veya URL' }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Bir metin dosyasının içeriğini oku. ~ ev dizinini temsil eder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Okunacak dosya yolu' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Bir dosyaya içerik yaz (varsa üzerine yazar, yoksa oluşturur). ~ ev dizinini temsil eder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Yazılacak dosya yolu' },
          content: { type: 'string', description: 'Dosyaya yazılacak içerik' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'Bir klasördeki dosya ve klasörleri listele. Boş bırakılırsa ev dizini listelenir.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Listelenecek klasör yolu (opsiyonel)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'İnternette güncel bilgi ara (haberler, hava durumu, gerçek zamanlı veriler). Tavily kullanır.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Arama sorgusu' }
        },
        required: ['query']
      }
    }
  }
]

// ---- Executors ----
const executors: Record<string, (args: any) => Promise<ToolResult>> = {
  async run_command({ command }) {
    return run(`powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`)
  },

  async open_app({ target }) {
    await run(`powershell -NoProfile -Command "Start-Process '${target.replace(/'/g, "''")}'"`)
    return `Açıldı: ${target}`
  },

  async read_file({ path: p }) {
    try {
      const full = resolvePath(p)
      const data = fs.readFileSync(full, 'utf-8')
      return data.length > 8000 ? data.slice(0, 8000) + '\n...(kısaltıldı)' : data
    } catch (e: any) {
      return `HATA: ${e.message}`
    }
  },

  async write_file({ path: p, content }) {
    try {
      const full = resolvePath(p)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, content, 'utf-8')
      return `Yazıldı: ${full} (${content.length} karakter)`
    } catch (e: any) {
      return `HATA: ${e.message}`
    }
  },

  async list_directory({ path: p }) {
    try {
      const full = resolvePath(p || '')
      const items = fs.readdirSync(full, { withFileTypes: true })
      if (items.length === 0) return '(boş klasör)'
      return items
        .map((d: any) => (d.isDirectory() ? `📁 ${d.name}` : `📄 ${d.name}`))
        .join('\n')
    } catch (e: any) {
      return `HATA: ${e.message}`
    }
  },

  async web_search({ query }) {
    const key = process.env.TAVILY_API_KEY
    if (!key) return 'HATA: TAVILY_API_KEY ayarlanmamış. Web araması için .env dosyasına Tavily anahtarı ekle.'
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query, max_results: 5, include_answer: true })
      })
      const data: any = await res.json()
      let out = data.answer ? `Özet: ${data.answer}\n\n` : ''
      out += (data.results || [])
        .map((r: any) => `• ${r.title}\n  ${r.url}\n  ${(r.content || '').slice(0, 200)}`)
        .join('\n\n')
      return out || '(sonuç bulunamadı)'
    } catch (e: any) {
      return `HATA: ${e.message}`
    }
  }
}

async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
  const fn = executors[name]
  if (!fn) return `HATA: bilinmeyen araç "${name}"`
  let args: any = {}
  try {
    args = argsJson ? JSON.parse(argsJson) : {}
  } catch {
    return `HATA: araç argümanları çözümlenemedi: ${argsJson}`
  }
  try {
    return await fn(args)
  } catch (e: any) {
    return `HATA: ${e.message}`
  }
}

module.exports = { toolSchemas, executeTool }
