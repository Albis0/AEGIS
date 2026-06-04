import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";

function run(cmd: string, cwd: string, timeoutMs = 60000): Promise<string> {
    return new Promise((res) => {
        execCb(cmd, {timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024, cwd},
            (err, stdout, stderr) => {
                const out = (stdout ?? "").trim();
                const errOut = (stderr ?? "").trim();
                if (err && !out) res(`HATA: ${err.message}\n${errOut}`.slice(0, 3000));
                else res((out || errOut || "(çıktı yok)").slice(0, 3000));
            }
        );
    });
}

interface ProjectInfo {
    type: string;
    buildCmd: string;
    testCmd: string;
    lintCmd: string;
    formatCmd: string;
}

export function detectProject(dir: string): ProjectInfo {
    const has = (f: string) => fs.existsSync(path.join(dir, f));
    if (has("package.json")) {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
        const scripts = pkg.scripts ?? {};
        const pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : "npm";
        const hasBuild = !!scripts.build;
        const hasTest = !!scripts.test;
        const hasLint = !!scripts.lint;
        return {
            type: "Node.js/TypeScript",
            buildCmd: hasBuild ? `${pm} run build` : `${pm} install`,
            testCmd: hasTest ? `${pm} test` : "echo '(test scripti yok)'",
            lintCmd: hasLint ? `${pm} run lint` : has("node_modules/.bin/eslint") ? "npx eslint ." : "echo '(lint kurulu değil)'",
            formatCmd: has("node_modules/.bin/prettier") ? "npx prettier --write ." : "echo '(prettier kurulu değil)'",
        };
    }
    if (has("Cargo.toml")) return {
        type: "Rust",
        buildCmd: "cargo build",
        testCmd: "cargo test",
        lintCmd: "cargo clippy",
        formatCmd: "rustfmt --edition 2021 src/*.rs",
    };
    if (has("requirements.txt") || has("pyproject.toml") || has("setup.py")) return {
        type: "Python",
        buildCmd: has("requirements.txt") ? "pip install -r requirements.txt" : "pip install -e .",
        testCmd: has("pytest.ini") || has("pyproject.toml") ? "pytest" : "python -m unittest discover",
        lintCmd: "pylint . || flake8 . || echo '(lint kurulu değil)'",
        formatCmd: "black . || autopep8 --in-place --recursive . || echo '(formatter kurulu değil)'",
    };
    if (has("go.mod")) return {
        type: "Go",
        buildCmd: "go build ./...",
        testCmd: "go test ./...",
        lintCmd: "golangci-lint run || staticcheck ./... || echo '(lint kurulu değil)'",
        formatCmd: "gofmt -w .",
    };
    if (has("pom.xml") || has("build.gradle")) return {
        type: "Java/JVM",
        buildCmd: has("mvnw") ? "./mvnw package -DskipTests" : has("gradlew") ? "./gradlew build -x test" : "mvn package -DskipTests",
        testCmd: has("mvnw") ? "./mvnw test" : "./gradlew test",
        lintCmd: "echo '(checkstyle gerekli)'",
        formatCmd: "echo '(google-java-format gerekli)'",
    };
    return {
        type: "Bilinmiyor",
        buildCmd: "echo 'Proje tipi tanınamadı. Komutu manuel belirt.'",
        testCmd: "echo 'Test komutu bilinmiyor.'",
        lintCmd: "echo 'Lint komutu bilinmiyor.'",
        formatCmd: "echo 'Format komutu bilinmiyor.'",
    };
}

export async function buildProject(dir: string): Promise<string> {
    if (!fs.existsSync(dir)) return `HATA: Klasör bulunamadı: ${dir}`;
    const info = detectProject(dir);
    const result = await run(info.buildCmd, dir, 120000);
    const success = !result.startsWith("HATA") && !result.toLowerCase().includes("error:");
    return `Proje Tipi: ${info.type}\nKomut: ${info.buildCmd}\n\n${success ? "BUILD BAŞARILI" : "BUILD HATALI"}\n\n${result}`;
}

export async function runTests(dir: string, testFile?: string): Promise<string> {
    if (!fs.existsSync(dir)) return `HATA: Klasör bulunamadı: ${dir}`;
    const info = detectProject(dir);
    const cmd = testFile ? `${info.testCmd.split(" ")[0]} ${testFile}` : info.testCmd;
    const result = await run(cmd, dir, 120000);
    const lines = result.split("\n");
    const passed = lines.filter((l) => /pass|ok|success/i.test(l)).length;
    const failed = lines.filter((l) => /fail|error|FAILED/i.test(l)).length;
    return `Proje Tipi: ${info.type}\nKomut: ${cmd}\n\nGeçen: ${passed} | Başarısız: ${failed}\n\n${result}`;
}

export async function lintProject(dir: string): Promise<string> {
    if (!fs.existsSync(dir)) return `HATA: Klasör bulunamadı: ${dir}`;
    const info = detectProject(dir);
    const result = await run(info.lintCmd, dir, 60000);
    return `Proje Tipi: ${info.type}\nKomut: ${info.lintCmd}\n\n${result}`;
}

export async function formatCode(dir: string): Promise<string> {
    if (!fs.existsSync(dir)) return `HATA: Klasör bulunamadı: ${dir}`;
    const info = detectProject(dir);
    const result = await run(info.formatCmd, dir, 60000);
    return `Proje Tipi: ${info.type}\nKomut: ${info.formatCmd}\n\n${result}`;
}

export function getProjectInfo(dir: string): string {
    if (!fs.existsSync(dir)) return `HATA: Klasör bulunamadı: ${dir}`;
    const info = detectProject(dir);
    return `Proje Tipi: ${info.type}\nBuild: ${info.buildCmd}\nTest: ${info.testCmd}\nLint: ${info.lintCmd}\nFormat: ${info.formatCmd}`;
}
