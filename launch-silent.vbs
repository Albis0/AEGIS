Set WshShell = CreateObject("WScript.Shell")
WshShell.Environment("Process")("VITE_DEV_SERVER_URL") = "http://127.0.0.1:5173"
WshShell.Environment("Process")("NODE_ENV") = "development"
WshShell.Run "node launch-electron.js", 0, False
