// AEGIS — Tool schemas (pure data)
//
// All tool definitions (ChatCompletionTool[]) are collected here. There are no
// side effects / helper dependencies — data only. Executors live in ../tools.ts;
// the tool selection logic (getAllToolSchemas) imports these groups.
//
// NOTE: Groq returns tool_use_failed when a number param receives a string → so
// numeric parameters are deliberately defined as "string" type in the schema.

import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";

export const toolSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "quit_self",
            description: "Close the AEGIS application. Use when the user says something like 'shut yourself down', 'close the app', 'exit'.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "run_command",
            description: "Run a Windows PowerShell command. FORBIDDEN: NEVER use this to launch a Steam game — use the steam_launch tool for that. Likewise use the spotify_* tools for Spotify.",
            parameters: {
                type: "object",
                properties: {command: {type: "string", description: "The PowerShell command to run"}},
                required: ["command"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Read the contents of a text file. ~ represents the home directory.",
            parameters: {
                type: "object",
                properties: {path: {type: "string", description: "Path of the file to read"}},
                required: ["path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: "Write content to a file (overwrites if it exists, creates it otherwise).",
            parameters: {
                type: "object",
                properties: {
                    path: {type: "string", description: "Path of the file to write"},
                    content: {type: "string", description: "Content to write to the file"},
                },
                required: ["path", "content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_file",
            description: "Delete a file or folder. Only works when Full PC Access is enabled. ~ represents the home directory.",
            parameters: {
                type: "object",
                properties: {
                    path: {type: "string", description: "Path of the file/folder to delete"},
                    recursive: {type: "string", description: "For a folder, delete it along with its contents: 'true' (default) or 'false'"},
                },
                required: ["path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "move_file",
            description: "Move or rename a file or folder. Only works when Full PC Access is enabled. ~ represents the home directory.",
            parameters: {
                type: "object",
                properties: {
                    source: {type: "string", description: "Source file/folder path"},
                    destination: {type: "string", description: "Destination path"},
                },
                required: ["source", "destination"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: "List the files and folders in a directory.",
            parameters: {
                type: "object",
                properties: {path: {type: "string", description: "Path of the folder to list (optional)"}},
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the internet for up-to-date information. Uses Tavily.",
            parameters: {
                type: "object",
                properties: {query: {type: "string", description: "Search query"}},
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_profile",
            description: "Save a piece of information about the user. E.g. name, occupation, preferences, habits.",
            parameters: {
                type: "object",
                properties: {
                    key: {type: "string", description: "Info key (e.g. 'name', 'occupation', 'coffee_preference')"},
                    value: {type: "string", description: "Info value"},
                },
                required: ["key", "value"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_profile",
            description: "Retrieve saved user information.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "save_note",
            description: "Save a note or reminder. If a date/time is given, it will remind at that time.",
            parameters: {
                type: "object",
                properties: {
                    content: {type: "string", description: "Note content"},
                    remind_at: {type: "string", description: "ISO 8601 date/time (optional, e.g. '2026-06-01T09:00:00')"},
                },
                required: ["content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_notes",
            description: "List pending notes and reminders.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "done_note",
            description: "Mark a note as completed.",
            parameters: {
                type: "object",
                properties: {id: {type: "string", description: "Note ID"}},
                required: ["id"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_clipboard",
            description: "Read the text on the clipboard. E.g. 'read the clipboard', 'what's on the clipboard?'.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "write_clipboard",
            description: "Copy text to the clipboard. E.g. 'copy this', 'write to clipboard'.",
            parameters: {
                type: "object",
                properties: {text: {type: "string", description: "Text to write to the clipboard"}},
                required: ["text"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_windows",
            description: "List the windows that are currently open.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "focus_window",
            description: "Bring the specified window to the foreground / focus it. E.g. 'bring Chrome to front', 'open VSCode'.",
            parameters: {
                type: "object",
                properties: {title: {type: "string", description: "Window title or app name (partial match is fine)"}},
                required: ["title"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_volume",
            description: "Set the system volume level (0-100). E.g. 'set volume to 50%', 'turn volume up/down'.",
            parameters: {
                type: "object",
                properties: {level: {type: "string", description: "Volume level 0-100"}},
                required: ["level"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_brightness",
            description: "Set the screen brightness (0-100). Works on internal displays.",
            parameters: {
                type: "object",
                properties: {level: {type: "string", description: "Brightness 0-100"}},
                required: ["level"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "remind_in",
            description: "Send the user a voice/text reminder after X minutes. E.g. 'remind me in 10 minutes', 'in half an hour...'.",
            parameters: {
                type: "object",
                properties: {
                    message: {type: "string", description: "Reminder message"},
                    minutes: {type: "string", description: "How many minutes from now (decimals allowed, e.g. 0.5 = 30 seconds)"},
                },
                required: ["message", "minutes"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "save_app_profile",
            description: "Save an app profile. One PowerShell command per line. E.g. 'save gaming mode', 'create a work profile'.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Profile name (e.g. gaming_mode, work_mode)"},
                    commands: {type: "string", description: "One PowerShell command per line (e.g. Start-Process chrome\\nStart-Process code)"},
                },
                required: ["name", "commands"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "run_app_profile",
            description: "Run a saved app profile. E.g. 'open gaming mode', 'switch to work mode'.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Name of the profile to run"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_app_profiles",
            description: "List the saved app profiles.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "screenshot",
            description: "Take a screenshot of the screen and analyze it. Use for questions like 'what's on my screen?', 'what is this error?', 'analyze the screen'. Specify what to ask about via the question parameter.",
            parameters: {
                type: "object",
                properties: {
                    question: {type: "string", description: "Question to ask about the screen or analysis to perform (e.g. 'What's on the screen?', 'What does this error message mean?', 'Which app is open?')"},
                },
                required: ["question"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_language",
            description: "Switch the interface and response language. Call when user asks to change language (e.g. 'switch to English', 'Türkçeye geç', 'Auf Deutsch wechseln', 'en français', 'cambia a español').",
            parameters: {
                type: "object",
                properties: {
                    language: {
                        type: "string",
                        enum: ["tr", "en", "de", "fr", "es"],
                        description: "Language code: tr=Turkish, en=English, de=German, fr=French, es=Spanish",
                    },
                },
                required: ["language"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fetch_url",
            description: "Fetch the contents of a web page and return it as plain text. E.g. 'what does this page say?', 'read the URL', 'summarize the article'.",
            parameters: {
                type: "object",
                properties: {
                    url: {type: "string", description: "URL of the web page to read (e.g. https://example.com)"},
                },
                required: ["url"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "show_notification",
            description: "Show a system notification balloon on Windows. E.g. 'send a notification', 'notify me', 'toast notification'.",
            parameters: {
                type: "object",
                properties: {
                    title: {type: "string", description: "Notification title"},
                    body: {type: "string", description: "Notification content / message"},
                },
                required: ["title", "body"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_plugins",
            description: "List installed plugins and the tools they provide.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "reload_plugins",
            description: "Reload plugins from the ~/.aegis/plugins/ folder. Use after adding a new plugin.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    // Faz CC-4 — skill / prompt packages.
    {
        type: "function",
        function: {
            name: "list_skills",
            description: "List installed skills (packaged instruction sets). Use when the user asks what skills exist or how to use them. A skill activates automatically when the user types /skill-name or describes a matching task.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    // Faz CC-3 — task planning / live todo tracking (Claude-Code TodoWrite parity).
    {
        type: "function",
        function: {
            name: "plan_todo",
            description: "For a multi-step task (roughly 3+ steps), publish a live plan the user can watch. Call it once at the start with all steps 'pending', then call it again after each step to flip that step to 'done' (and the next to 'in_progress'). Skip it for simple one-shot requests.",
            parameters: {
                type: "object",
                properties: {
                    steps: {
                        type: "array",
                        description: "Ordered list of steps. Each: {text, status}. status = pending | in_progress | done.",
                        items: {
                            type: "object",
                            properties: {
                                text: {type: "string", description: "Short description of the step"},
                                status: {type: "string", enum: ["pending", "in_progress", "done"], description: "Current status"},
                            },
                            required: ["text", "status"],
                            additionalProperties: false,
                        },
                    },
                },
                required: ["steps"],
                additionalProperties: false,
            },
        },
    },
];

export const schedulerSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "schedule_task",
            description: "Create a recurring scheduled task. E.g. 'tell me the weather every morning', 'check CPU usage every hour'.",
            parameters: {
                type: "object",
                properties: {
                    name:     {type: "string", description: "Task name (unique, short)"},
                    schedule: {type: "string", description: "Schedule: 'every 30 minutes', 'every 2 hours', 'daily at 09:00', 'hourly'"},
                    command:  {type: "string", description: "Natural language command to send to AEGIS (e.g. 'tell me the weather')"},
                },
                required: ["name", "schedule", "command"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_scheduled_tasks",
            description: "List all scheduled tasks.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "cancel_scheduled_task",
            description: "Cancel a scheduled task (by name or ID).",
            parameters: {
                type: "object",
                properties: {
                    id_or_name: {type: "string", description: "Task name (partial match is fine) or ID"},
                },
                required: ["id_or_name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "toggle_scheduled_task",
            description: "Enable/disable a scheduled task.",
            parameters: {
                type: "object",
                properties: {
                    id_or_name: {type: "string", description: "Task name or ID"},
                },
                required: ["id_or_name"],
                additionalProperties: false,
            },
        },
    },
];

export const marketplaceSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "plugin_search",
            description: "Search for AEGIS plugins on GitHub. E.g. 'is there a Discord plugin?', 'search for a Notion integration'.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Search term"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "plugin_install",
            description: "Install a plugin from a GitHub repo. Format: 'user/aegis-plugin-x'.",
            parameters: {
                type: "object",
                properties: {
                    repo: {type: "string", description: "GitHub repo path (e.g.: user/aegis-plugin-discord)"},
                },
                required: ["repo"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "plugin_remove",
            description: "Remove an installed plugin.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Plugin name"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

export const securitySchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "vault_store",
            description: "Save an API key or sensitive data to Windows' encrypted store (safeStorage).",
            parameters: {
                type: "object",
                properties: {
                    key:   {type: "string", description: "Key name (e.g.: 'openai_key')"},
                    value: {type: "string", description: "Value to store"},
                },
                required: ["key", "value"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "vault_list",
            description: "List keys in the secure store (does not show values).",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "vault_delete",
            description: "Delete a key from the secure store.",
            parameters: {
                type: "object",
                properties: {
                    key: {type: "string", description: "Name of the key to delete"},
                },
                required: ["key"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "privacy_audit",
            description: "List what data is stored where. Use for things like \"run a privacy audit\", \"where do you store my data?\".",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "clear_old_data",
            description: "Clear old data (knowledge base chunks, disabled tasks). Use for things like \"delete data older than X days\".",
            parameters: {
                type: "object",
                properties: {
                    days: {type: "string", description: "Delete data older than this many days (default 30)"},
                },
                additionalProperties: false,
            },
        },
    },
];

export const memoryPlusSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "remember_fact",
            description: "Save a permanent fact to memory. Use for things like \"know this: my brother's name is Ahmet\", \"remember: the project deadline is July 15th\".",
            parameters: {
                type: "object",
                properties: {
                    content: {type: "string", description: "Fact to save"},
                    tags:    {type: "string", description: "Tags, comma-separated (optional, e.g.: 'family,personal')"},
                },
                required: ["content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_facts",
            description: "List saved facts. Use for things like \"what do you know?\", \"what info do you have stored?\".",
            parameters: {
                type: "object",
                properties: {
                    filter: {type: "string", description: "Filter term (optional)"},
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_memory",
            description: "Semantic search within saved facts. Use for questions like \"what did I say about X last month?\", \"what do you know about this topic?\" — unlike list_facts, this finds the most relevant facts using a match score.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Topic/question to search for"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "forget_fact",
            description: "Delete a saved fact.",
            parameters: {
                type: "object",
                properties: {
                    id_or_content: {type: "string", description: "Fact ID or content (partial match)"},
                },
                required: ["id_or_content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_habits",
            description: "Show your most-used tools and habit statistics.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    // Faz CC-5 — file-based persistent memory (human-readable markdown notes + index).
    // Distinct from remember_fact (quick DB facts): use these for durable, browsable
    // notes about the user, their feedback/preferences, ongoing projects, or references.
    {
        type: "function",
        function: {
            name: "remember_note",
            description: "Save a durable, human-readable memory as a markdown file the user can browse and edit. Prefer this over remember_fact for anything worth keeping across sessions: who the user is, their preferences/feedback, ongoing projects, or reference links. Updates an existing note with the same title instead of duplicating.",
            parameters: {
                type: "object",
                properties: {
                    fact:        {type: "string", description: "The thing to remember (can be multi-line)"},
                    type:        {type: "string", enum: ["user", "feedback", "project", "reference"], description: "user=who they are, feedback=how to work with them, project=ongoing work, reference=external links/resources"},
                    title:       {type: "string", description: "Optional short title (becomes the filename slug)"},
                    description: {type: "string", description: "Optional one-line summary shown in the index"},
                },
                required: ["fact"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "recall_note",
            description: "Read the full detail of a saved file-memory by name. Use when the session index mentions a memory and you need its full text.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Memory name/title (partial match is fine)"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_notes_md",
            description: "List all file-memories (markdown notes) with their type and summary.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "forget_note",
            description: "Delete a file-memory (markdown note) by name.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Memory name/title to delete (partial match)"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

export const knowledgeSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "index_file",
            description: "Index a file into the knowledge base. Supports .txt, .md, .ts, .js, .py, .json, .csv.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Path of the file to index (~ supported)"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "index_folder",
            description: "Index all suitable files in a folder into the knowledge base.",
            parameters: {
                type: "object",
                properties: {
                    folder_path: {type: "string", description: "Folder path"},
                    extensions:  {type: "string", description: "Comma-separated extensions (default: .txt,.md,.ts,.js,.py)"},
                },
                required: ["folder_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_knowledge",
            description: "Semantic search within the knowledge base. Use for things like \"what's in my project notes about X?\".",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Search query"},
                    top_k: {type: "string", description: "Number of results to return (default 5)"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "chat_with_file",
            description: "Chat with a file — load its content as context. Use for things like \"what does this PDF say?\", \"summarize this file\".",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Path of the file to read"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_indexed_files",
            description: "List files indexed in the knowledge base.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_from_index",
            description: "Remove a file from the knowledge base.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Path of the file to remove"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
];

export const automationSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "if_then",
            description: "Set up a conditional automation. Use for things like \"dim the screen at 11pm\", \"stop the music when CPU goes over 90\". Supported metrics: cpu, ram, gpu, disk, hour, minute.",
            parameters: {
                type: "object",
                properties: {
                    condition: {type: "string", description: "Condition expression: 'cpu > 80', 'hour == 23', 'ram >= 75'"},
                    action:    {type: "string", description: "Command to send to AEGIS when triggered"},
                },
                required: ["condition", "action"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_automations",
            description: "List defined automation rules.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_automation",
            description: "Delete an automation rule.",
            parameters: {
                type: "object",
                properties: {
                    id_or_condition: {type: "string", description: "Automation ID or condition expression (partial match)"},
                },
                required: ["id_or_condition"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "toggle_automation",
            description: "Enable/disable an automation rule.",
            parameters: {
                type: "object",
                properties: {
                    id_or_condition: {type: "string", description: "Automation ID or condition expression"},
                },
                required: ["id_or_condition"],
                additionalProperties: false,
            },
        },
    },
];

export const macroSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "start_macro",
            description: "Start recording a macro. Commands given after this are added to the macro. Use for things like \"record my morning routine\", \"create a game-launch macro\".",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Macro name"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "stop_macro",
            description: "Stop the active macro recording and save it.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "run_macro",
            description: "Run a saved macro. Use for things like \"run my morning routine\", \"start the game macro\".",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Macro name (partial match is fine)"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_macros",
            description: "List saved macros.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "delete_macro",
            description: "Delete a macro.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Name or ID of the macro to delete"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

// Phase 52 — Routines: record tool calls and replay them deterministically
export const routineSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "routine_record_start",
            description: "Start recording a routine. Any ACTIONS you take afterward (spotify, steam, system, file, etc.) are automatically recorded into this routine. Use for things like \"start recording: Game Mode\", \"create a Game Mode routine\". Read-only operations (search, screenshot) are not recorded.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Routine name, e.g. 'Game Mode'"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_record_stop",
            description: "End the active routine recording and save it. \"Finish recording\", \"stop the recording\".",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "routine_record_cancel",
            description: "Cancel the active routine recording WITHOUT saving it. \"Cancel the recording\", \"never mind\".",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "routine_run",
            description: "Run a saved routine — applies its steps in order, deterministically. \"Turn on Game Mode\", \"run the Game Mode routine\".",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Routine name (partial match is fine)"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_list",
            description: "List saved routines.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "routine_show",
            description: "Show a routine's steps in detail (for reviewing before editing).",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Routine name or ID"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_delete",
            description: "Delete a routine.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Name or ID of the routine to delete"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_rename",
            description: "Rename a routine.",
            parameters: {
                type: "object",
                properties: {
                    name:     {type: "string", description: "Existing routine name or ID"},
                    new_name: {type: "string", description: "New name"},
                },
                required: ["name", "new_name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_delete_step",
            description: "Remove a specific step from a routine (editing). Find the step number with 'routine_show'.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Routine name or ID"},
                    step: {type: "string", description: "Number of the step to remove (1-based)"},
                },
                required: ["name", "step"],
                additionalProperties: false,
            },
        },
    },
];

export const agentSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "agent_run",
            description: "Start agent mode: give a goal, and AEGIS chains its tools together to complete it. For complex tasks like 'summarize all .txt files in this folder' or 'optimize the system'.",
            parameters: {
                type: "object",
                properties: {
                    goal:      {type: "string", description: "The goal to complete (be clear and specific)"},
                    max_steps: {type: "string", description: "Maximum number of steps (default 10, max 20)"},
                },
                required: ["goal"],
                additionalProperties: false,
            },
        },
    },
    // Faz CC-6 — subagent delegation (Claude-Code subagent parity).
    {
        type: "function",
        function: {
            name: "spawn_subagent",
            description: "Delegate a self-contained subtask to an isolated agent that runs its own tool loop and returns a text result you can use. Use it to fan out independent work (e.g. summarize 3 files separately) or to keep a noisy subtask out of the main context. The subagent cannot spawn further subagents.",
            parameters: {
                type: "object",
                properties: {
                    task: {type: "string", description: "A clear, self-contained instruction for the subagent (it does not see this conversation)."},
                },
                required: ["task"],
                additionalProperties: false,
            },
        },
    },
];

export const watchSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "watch_condition",
            description: "Monitor a system metric and notify when a threshold is crossed. For example: 'alert me if GPU goes above 90%', 'notify me if RAM goes over 80%'.",
            parameters: {
                type: "object",
                properties: {
                    metric:    {type: "string", description: "Metric to monitor: cpu, ram, gpu, disk"},
                    threshold: {type: "string", description: "Threshold value (percent, 1-100)"},
                    direction: {type: "string", description: "'above' (if it goes above) or 'below' (if it drops below)"},
                },
                required: ["metric", "threshold"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_watch_conditions",
            description: "List active threshold watches.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_watch_condition",
            description: "Remove a threshold watch.",
            parameters: {
                type: "object",
                properties: {
                    metric: {type: "string", description: "Metric to remove: cpu, ram, gpu, disk"},
                },
                required: ["metric"],
                additionalProperties: false,
            },
        },
    },
];

// ───────────────────────────────────────────────────────────── Phase 19 Schemas
export const soundSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"play_sound",description:"Play a sound file (.mp3/.wav). Files in the ~/.aegis/sounds/ folder or a full path.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Path to the sound file (e.g. notification.wav, ~/sounds/ding.mp3)"},volume:{type: "string",description:"Volume level 0-100 (default 50)"}},required:["file_path"],additionalProperties:false}}},
    {type:"function",function:{name:"ambient_start",description:"Start a background ambient sound. For focus, relaxation, or work music.",parameters:{type:"object",properties:{category:{type:"string",description:"Ambient category: rain, forest, cafe, white, space, lofi"},volume:{type: "string",description:"Volume level 0-100 (default 30)"}},required:["category"],additionalProperties:false}}},
    {type:"function",function:{name:"ambient_stop",description:"Stop the playing ambient sound.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_sounds",description:"List available sound files and ambient categories.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 20 Schemas
export const codeToolSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"git_status",description:"Show Git repo status: staged, unstaged, untracked files.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path (default: current directory)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_log",description:"List recent commits. Supports a graph/tree view.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},count:{type: "string",description:"Number of commits to show (default 10)"},graph:{type:"boolean",description:"true = show an ASCII branch graph"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_diff",description:"Show staged or unstaged changes. A specific file can be given.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},staged:{type:"boolean",description:"true = staged changes, false = unstaged (default false)"},file:{type:"string",description:"Show the diff for only this file (optional)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_add",description:"Stage files (git add). '.' = all changes.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},files:{type:"string",description:"File/pattern to stage. '.' = everything, or a specific file/folder name"}},required:["files"],additionalProperties:false}}},
    {type:"function",function:{name:"git_commit",description:"Commit staged changes. With add_all=true, stages all changes first.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},message:{type:"string",description:"Commit message"},add_all:{type:"boolean",description:"true = run git add . first, then commit"}},required:["message"],additionalProperties:false}}},
    {type:"function",function:{name:"git_push",description:"Push changes to the remote (git push).",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},remote:{type:"string",description:"Remote name (default: origin)"},branch:{type:"string",description:"Branch name (default: current branch)"},force:{type:"boolean",description:"true = force push with --force-with-lease"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_pull",description:"Pull changes from the remote (git pull).",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},remote:{type:"string",description:"Remote name (default: origin)"},rebase:{type:"boolean",description:"true = pull with --rebase"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_branch",description:"Create, switch, delete, or list branches. Use action=graph for a visual branch map.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},action:{type:"string",description:"list, create, switch, delete, graph (visual tree)"},branch_name:{type:"string",description:"Branch name (for create/switch/delete)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"git_stash",description:"Temporarily store changes or restore them.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},action:{type:"string",description:"save, pop, list, drop, apply"},message:{type:"string",description:"Stash message (optional for save)"},index:{type: "string",description:"Stash index (for drop/apply, default 0)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"git_merge",description:"Merge a branch. Supports fast-forward or no-ff.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},branch:{type:"string",description:"Branch to merge"},no_ff:{type:"boolean",description:"true = use --no-ff (create a merge commit)"}},required:["branch"],additionalProperties:false}}},
    {type:"function",function:{name:"git_reset",description:"Unstage staged files or undo the last commit.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},mode:{type:"string",description:"soft (undo commit, files stay staged), mixed (default, clear staged), hard (warning! deletes all changes)"},commits:{type: "string",description:"How many commits to go back (default 1)"},file:{type:"string",description:"Unstage a specific file (used instead of mode)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_remote",description:"List or add/change remote URLs.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo path"},action:{type:"string",description:"list, add, set-url"},name:{type:"string",description:"Remote name"},url:{type:"string",description:"Remote URL"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"run_and_analyze",description:"Run a command and analyze its output. Explains error messages and suggests fixes.",parameters:{type:"object",properties:{command:{type:"string",description:"Command to run"},context:{type:"string",description:"Extra context (e.g. this is a Node.js project)"}},required:["command"],additionalProperties:false}}},
    {type:"function",function:{name:"scaffold_project",description:"Create a new project from a ready-made template. Example: 'Python FastAPI', 'React Tailwind', 'Node Express'.",parameters:{type:"object",properties:{template:{type:"string",description:"Template name: python-fastapi, react-tailwind, node-express, electron-app, next-ts"},target_path:{type:"string",description:"Directory where the project will be created (default: Desktop)"}},required:["template"],additionalProperties:false}}},
    {type:"function",function:{name:"list_templates",description:"List available project templates.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    // Faz CC-1 — code-aware file tools (glob / grep / edit), Claude-Code style.
    {type:"function",function:{name:"glob_files",description:"Find files by name pattern (glob). Supports **, *, ?, and {a,b}. E.g. '**/*.ts', 'src/**/*.{ts,tsx}'. Skips node_modules/.git etc., returns newest first (max 100).",parameters:{type:"object",properties:{pattern:{type:"string",description:"Glob pattern, e.g. '**/*.ts' or 'src/**/*.{ts,tsx}'"},cwd:{type:"string",description:"Directory to search under (default: current working directory)"}},required:["pattern"],additionalProperties:false}}},
    {type:"function",function:{name:"grep_content",description:"Search file CONTENTS by regular expression across a folder. Returns file:line: match. Skips binary/large files, node_modules/.git. Use to locate code, e.g. where 'runAgentLoop' is defined.",parameters:{type:"object",properties:{pattern:{type:"string",description:"Regex to search for (JS regex syntax)"},glob:{type:"string",description:"Only search files whose path matches this glob (optional, e.g. '**/*.ts')"},path:{type:"string",description:"File or folder to search in (default: current working directory)"},ignore_case:{type:"boolean",description:"true = case-insensitive match"}},required:["pattern"],additionalProperties:false}}},
    {type:"function",function:{name:"edit_file",description:"Make an exact-string replacement in a file. old_string must match EXACTLY (including whitespace) and be UNIQUE unless replace_all=true. Prefer this over write_file for surgical changes — it never rewrites the whole file.",parameters:{type:"object",properties:{path:{type:"string",description:"Path of the file to edit (~ = home)"},old_string:{type:"string",description:"Exact text to replace (must be unique in the file unless replace_all)"},new_string:{type:"string",description:"Text to replace it with"},replace_all:{type:"boolean",description:"true = replace every occurrence instead of requiring uniqueness"}},required:["path","old_string","new_string"],additionalProperties:false}}},
    // Faz CC-2 — general-purpose shell with cwd/timeout/background (Claude-Code Bash parity).
    {type:"function",function:{name:"run_shell",description:"Run a shell command in a specific directory with a timeout and optional background mode. Use this (not run_command) when you need a working directory, a long timeout, or to run something detached — e.g. 'npm test' in a project folder. Requires approval. Output is clipped to 30k chars.",parameters:{type:"object",properties:{command:{type:"string",description:"The command to run (PowerShell on Windows)"},cwd:{type:"string",description:"Working directory to run in (default: current)"},timeout_seconds:{type:"string",description:"Timeout in seconds (default 120, max 600)"},background:{type:"boolean",description:"true = run detached and return immediately; you get notified when it finishes"}},required:["command"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 21 Schemas
export const timeSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"pomodoro_start",description:"Start the Pomodoro timer. 25 minutes work / 5 minutes break cycle.",parameters:{type:"object",properties:{work_minutes:{type: "string",description:"Work duration in minutes (default 25)"},break_minutes:{type: "string",description:"Break duration in minutes (default 5)"}},additionalProperties:false}}},
    {type:"function",function:{name:"pomodoro_stop",description:"Stop the running Pomodoro timer.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"pomodoro_status",description:"Return Pomodoro status (machine-readable for the UI widget): 'PHASE|remainingSeconds|session' if active, otherwise 'INACTIVE'.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"time_track_start",description:"Start task-based time tracking.",parameters:{type:"object",properties:{task_name:{type:"string",description:"Name of the task to track"}},required:["task_name"],additionalProperties:false}}},
    {type:"function",function:{name:"time_track_stop",description:"Stop time tracking and save the duration.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"time_track_report",description:"Show a daily/weekly time-spent report.",parameters:{type:"object",properties:{period:{type:"string",description:"Period: today, week, month (default: today)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_get_events",description:"Fetch events from Windows Calendar. Today's events or events on a specified date.",parameters:{type:"object",properties:{date:{type:"string",description:"Date in YYYY-MM-DD format (default: today)"},days_ahead:{type: "string",description:"How many days ahead to look (default 1)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_add_event",description:"Add an event to Windows Calendar.",parameters:{type:"object",properties:{title:{type:"string",description:"Event title"},start_time:{type:"string",description:"Start time (e.g. 2024-01-15 14:00)"},duration_minutes:{type: "string",description:"Duration in minutes (default 60)"},notes:{type:"string",description:"Notes (optional)"}},required:["title","start_time"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 22 Schemas
export const mediaSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"organize_folder",description:"Scan a folder and move files into subfolders by extension/date.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Folder path to organize"},by:{type:"string",description:"Grouping criteria: extension or date (default: extension)"}},required:["folder_path"],additionalProperties:false}}},
    {type:"function",function:{name:"find_duplicates",description:"Find duplicate files in a folder via hash comparison.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Folder to scan"},recursive:{type:"boolean",description:"Also scan subfolders (default true)"}},required:["folder_path"],additionalProperties:false}}},
    {type:"function",function:{name:"bulk_rename",description:"Bulk-rename files in a folder.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Folder path"},pattern:{type:"string",description:"Existing pattern (regex or literal text)"},replacement:{type:"string",description:"New name pattern ($1 = capture group, {n} = sequence number)"},extension:{type:"string",description:"Apply only to this extension (optional, e.g. .jpg)"}},required:["folder_path","pattern","replacement"],additionalProperties:false}}},
    {type:"function",function:{name:"analyze_image",description:"Analyze a local image file with a vision model.",parameters:{type:"object",properties:{image_path:{type:"string",description:"Path to the image file"},question:{type:"string",description:"Question about the image (optional)"}},required:["image_path"],additionalProperties:false}}},
    {type:"function",function:{name:"resize_image",description:"Resize an image.",parameters:{type:"object",properties:{image_path:{type:"string",description:"Image path"},width:{type: "string",description:"Target width (pixels)"},height:{type: "string",description:"Target height (pixels, optional — proportional)"},output_path:{type:"string",description:"Output path (optional, default: source_resized.ext)"}},required:["image_path","width"],additionalProperties:false}}},
    {type:"function",function:{name:"convert_image",description:"Convert an image file to a different format (PNG/JPEG/BMP/GIF).",parameters:{type:"object",properties:{image_path:{type:"string",description:"Source image path"},output_format:{type:"string",description:"Target format: png, jpg, bmp, gif"},output_path:{type:"string",description:"Output path (optional)"}},required:["image_path","output_format"],additionalProperties:false}}},
    {type:"function",function:{name:"pdf_to_text",description:"Extract text from a PDF file.",parameters:{type:"object",properties:{pdf_path:{type:"string",description:"Path to the PDF file"},max_chars:{type: "string",description:"Maximum character count (default 10000)"}},required:["pdf_path"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 23 Schemas
export const personaSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"set_persona",description:"Change AEGIS's active personality. Different modes: formal assistant, friendly companion, tough coach, teacher.",parameters:{type:"object",properties:{name:{type:"string",description:"Persona name: default, formal, friendly, coach, teacher, or a custom persona name"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"get_persona",description:"Show the currently active personality.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_personas",description:"List all available personalities.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"add_persona",description:"Add a new custom personality.",parameters:{type:"object",properties:{name:{type:"string",description:"Personality name"},description:{type:"string",description:"Short description"},system_prompt:{type:"string",description:"System instructions for this personality"}},required:["name","system_prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"roleplay_start",description:"Start roleplay mode as a specific character.",parameters:{type:"object",properties:{character:{type:"string",description:"Character description (e.g. 'experienced Python teacher', 'startup CEO')"},scenario:{type:"string",description:"Scenario context (optional)"}},required:["character"],additionalProperties:false}}},
    {type:"function",function:{name:"roleplay_stop",description:"Exit roleplay mode and return to normal mode.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 24 Schemas
export const networkSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"ping_host",description:"Ping a host to measure latency and packet loss.",parameters:{type:"object",properties:{host:{type:"string",description:"Target host (IP or domain)"},count:{type: "string",description:"Number of pings (default 4)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"trace_route",description:"Trace the network path to a host.",parameters:{type:"object",properties:{host:{type:"string",description:"Target host"},max_hops:{type: "string",description:"Maximum number of hops (default 30)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"port_scan",description:"Scan a host's open ports (local network, for educational purposes).",parameters:{type:"object",properties:{host:{type:"string",description:"Target host (IP)"},ports:{type:"string",description:"Port range (e.g. 80,443,8080 or 1-1024, default: 21,22,25,80,443,3306,8080)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"dns_lookup",description:"Query DNS records for a domain (A, MX, TXT).",parameters:{type:"object",properties:{domain:{type:"string",description:"Domain to query"},type:{type:"string",description:"Record type: A, MX, TXT, NS, CNAME (default A)"}},required:["domain"],additionalProperties:false}}},
    {type:"function",function:{name:"ssh_run",description:"Run a command on a remote server over SSH (a previously saved host).",parameters:{type:"object",properties:{host_alias:{type:"string",description:"Host alias from ~/.aegis/ssh-hosts.json"},command:{type:"string",description:"Command to run"}},required:["host_alias","command"],additionalProperties:false}}},
    {type:"function",function:{name:"ssh_add_host",description:"Save an SSH host profile.",parameters:{type:"object",properties:{alias:{type:"string",description:"Alias"},hostname:{type:"string",description:"IP or hostname"},username:{type:"string",description:"Username"},port:{type: "string",description:"SSH port (default 22)"},key_path:{type:"string",description:"Private key path (optional)"}},required:["alias","hostname","username"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_ps",description:"List running Docker containers.",parameters:{type:"object",properties:{all:{type:"boolean",description:"Also show stopped containers (default false)"}},additionalProperties:false}}},
    {type:"function",function:{name:"docker_start",description:"Start a Docker container.",parameters:{type:"object",properties:{container:{type:"string",description:"Container name or ID"}},required:["container"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_stop",description:"Stop a Docker container.",parameters:{type:"object",properties:{container:{type:"string",description:"Container name or ID"}},required:["container"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_logs",description:"Get Docker container logs.",parameters:{type:"object",properties:{container:{type:"string",description:"Container name or ID"},lines:{type: "string",description:"How many recent lines (default 50)"}},required:["container"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 25 Schemas
export const vizSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"create_chart",description:"Create an ASCII chart from data. Bar, line, or pie chart. Shown in the feed.",parameters:{type:"object",properties:{type:{type:"string",description:"Chart type: bar, line, pie"},data:{type:"string",description:"Data in JSON format: {labels:[...], values:[...]} or [[label,value],...]"},title:{type:"string",description:"Chart title (optional)"}},required:["type","data"],additionalProperties:false}}},
    {type:"function",function:{name:"system_report",description:"Generate a system health report: a summary of CPU, RAM, disk, GPU over the last 24 hours.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 26 Schemas
export const emailSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"email_send",description:"Send an email via SMTP. Credentials must be stored in the vault.",parameters:{type:"object",properties:{to:{type:"string",description:"Recipient email address"},subject:{type:"string",description:"Subject"},body:{type:"string",description:"Email body"},from_alias:{type:"string",description:"SMTP profile alias in the vault (default: default)"}},required:["to","subject","body"],additionalProperties:false}}},
    {type:"function",function:{name:"email_fetch",description:"Read the inbox via IMAP.",parameters:{type:"object",properties:{count:{type: "string",description:"How many recent emails (default 10)"},folder:{type:"string",description:"Folder name (default: INBOX)"},from_alias:{type:"string",description:"IMAP profile alias in the vault"}},additionalProperties:false}}},
    {type:"function",function:{name:"email_draft",description:"Generate a professional email draft from a natural-language description.",parameters:{type:"object",properties:{intent:{type:"string",description:"Purpose of the email (e.g. meeting proposal, complaint, thank-you)"},recipient:{type:"string",description:"Recipient's role/name"},tone:{type:"string",description:"Tone: formal, friendly, assertive (default: formal)"},language:{type:"string",description:"Language: tr, en (default: tr)"}},required:["intent"],additionalProperties:false}}},
    {type:"function",function:{name:"email_setup_smtp",description:"Save an SMTP/IMAP email profile (encrypted, into the vault).",parameters:{type:"object",properties:{alias:{type:"string",description:"Profile alias"},smtp_host:{type:"string",description:"SMTP server"},smtp_port:{type: "string",description:"SMTP port"},imap_host:{type:"string",description:"IMAP server"},imap_port:{type: "string",description:"IMAP port"},username:{type:"string",description:"Username (email)"},password:{type:"string",description:"Password (saved encrypted in the vault)"}},required:["alias","smtp_host","username","password"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 27 Schemas
export const learningSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"card_add",description:"Add a new flashcard. A prompt + answer pair.",parameters:{type:"object",properties:{front:{type:"string",description:"Question or topic"},back:{type:"string",description:"Answer or explanation"},tags:{type:"string",description:"Comma-separated tags (e.g. python,programming)"}},required:["front","back"],additionalProperties:false}}},
    {type:"function",function:{name:"card_review",description:"Study flashcards using spaced repetition. Shows cards due for review today.",parameters:{type:"object",properties:{tag:{type:"string",description:"Filter by a specific tag (optional)"},count:{type: "string",description:"How many cards to study (default 5)"}},additionalProperties:false}}},
    {type:"function",function:{name:"reading_add",description:"Add a URL or book to the reading list.",parameters:{type:"object",properties:{url_or_title:{type:"string",description:"Article URL or book title"},notes:{type:"string",description:"Notes (optional)"},priority:{type: "string",description:"Priority 1-5 (default 3)"}},required:["url_or_title"],additionalProperties:false}}},
    {type:"function",function:{name:"reading_list",description:"Show the reading list.",parameters:{type:"object",properties:{status:{type:"string",description:"Filter: all, pending, done (default: pending)"}},additionalProperties:false}}},
    {type:"function",function:{name:"reading_summarize",description:"Fetch an article from a URL and summarize it with an LLM.",parameters:{type:"object",properties:{url:{type:"string",description:"URL of the article to summarize"},add_to_list:{type:"boolean",description:"Also add to the reading list (default true)"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_set",description:"Define a new goal.",parameters:{type:"object",properties:{title:{type:"string",description:"Goal title"},deadline:{type:"string",description:"Deadline YYYY-MM-DD (optional)"},steps:{type:"string",description:"Comma-separated sub-steps (optional)"}},required:["title"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_check_in",description:"Update the progress of a goal.",parameters:{type:"object",properties:{goal_id_or_title:{type:"string",description:"Goal ID or title"},progress:{type: "string",description:"Completion percentage 0-100"},note:{type:"string",description:"Progress note (optional)"}},required:["goal_id_or_title","progress"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_list",description:"Show active goals and their completion percentages.",parameters:{type:"object",properties:{status:{type:"string",description:"Filter: all, active, done (default: active)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 28 Schemas
export const iotSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"list_bluetooth",description:"List connected and paired Bluetooth devices.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"connect_bluetooth",description:"Connect to a Bluetooth device.",parameters:{type:"object",properties:{device_name:{type:"string",description:"Device name (partial match supported)"}},required:["device_name"],additionalProperties:false}}},
    {type:"function",function:{name:"disconnect_bluetooth",description:"Disconnect a connected Bluetooth device.",parameters:{type:"object",properties:{device_name:{type:"string",description:"Device name"}},required:["device_name"],additionalProperties:false}}},
    {type:"function",function:{name:"list_usb",description:"List connected USB devices.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_printers",description:"List installed printers.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"print_file",description:"Print the specified file.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Path of the file to print"},printer_name:{type:"string",description:"Printer name (optional, default: default printer)"}},required:["file_path"],additionalProperties:false}}},
    {type:"function",function:{name:"printer_status",description:"Query printer status (paper, ink, queue).",parameters:{type:"object",properties:{printer_name:{type:"string",description:"Printer name (optional)"}},additionalProperties:false}}},
    {type:"function",function:{name:"weather_station",description:"Weather: temperature, humidity, pressure, wind. Uses the user's IP location if none is given. No API key required.",parameters:{type:"object",properties:{location:{type:"string",description:"City name (e.g. Ankara, Istanbul, London). If left blank, the user's location is auto-detected."}},additionalProperties:false}}},
];

// ───────────────────────────────────────── Phase 62 — Smart Home (Home Assistant)
// Manages all brands (Hue/Tapo/Tuya/Matter/Zigbee) behind a single HA server.
// Smart: natural language ("dim the living room", "turn everything off") resolves to entities.
// Critical devices (lock/heater/garage/outlet) require confirmation (confirm:"true").
export const smartHomeSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"smart_home_devices",description:"List smart home devices (lights, outlets, locks, thermostats, blinds...) and show their current states. Connects to Home Assistant.",parameters:{type:"object",properties:{area:{type:"string",description:"Show only this room/area (optional, e.g. living room, bedroom, kitchen)"}},additionalProperties:false}}},
    {type:"function",function:{name:"smart_home_status",description:"Query the status of a specific smart home device or room. For example: 'Is the living room light on?', 'What temperature is the thermostat set to?'.",parameters:{type:"object",properties:{target:{type:"string",description:"Device or room name (e.g. living room light, bedroom, front door lock)"}},required:["target"],additionalProperties:false}}},
    {type:"function",function:{name:"smart_home_control",description:"Control a smart home device: turn on/off, set brightness, lock/unlock, open/close blinds. Automatically resolves the natural-language target ('dim the living room', 'turn everything off', 'set the bedroom to 30%'). For critical devices (lock, heater, garage, outlet) it asks for confirmation first; once the user confirms, call again with confirm:\"true\".",parameters:{type:"object",properties:{target:{type:"string",description:"Target device/room/group (e.g. living room, bedroom lamp, front door, all lights, everything)"},action:{type:"string",enum:["on","off","toggle","brightness","temperature","lock","unlock","open","close"],description:"on=turn on, off=turn off, toggle=switch, brightness=set brightness (needs value), temperature=set temperature (needs value), lock/unlock=lock/unlock, open/close=open/close blinds/garage"},value:{type:"string",description:"0-100 percent for brightness, degrees (°C) for temperature. Leave empty for other actions."},confirm:{type:"string",description:"Critical device confirmation. Send \"true\" if the user said 'yes/confirm'; otherwise leave empty."}},required:["target","action"],additionalProperties:false}}},
    {type:"function",function:{name:"smart_home_scene",description:"Activate a smart home scene or script. Pre-defined scenes in HA like 'movie mode', 'good night', 'morning routine'.",parameters:{type:"object",properties:{name:{type:"string",description:"Scene/script name (e.g. movie mode, good night)"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"local_devices_scan",description:"DISCOVER devices on the home network (local WiFi/LAN) — Home Assistant is NOT required. Finds devices like Chromecast, smart TV, AirPlay, printer, NAS, speaker, router via mDNS/Bonjour and SSDP/UPnP broadcasts. Use for requests like 'find devices at home', 'what's on the network', 'scan for devices', 'local devices'.",parameters:{type:"object",properties:{duration_ms:{type:"string",description:"Scan duration in ms (default 3000, 1000-6000 recommended)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Phase 29 Schemas
export const multiModelSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"model_compare",description:"Send the same question to multiple models and compare their answers.",parameters:{type:"object",properties:{prompt:{type:"string",description:"Question/task to compare"},models:{type:"string",description:"Comma-separated models to compare (e.g. groq:llama-3.1-8b-instant,groq:openai/gpt-oss-20b)"}},required:["prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_run",description:"Run a step-by-step prompt chain. Each step's output feeds into the next.",parameters:{type:"object",properties:{pipeline_name:{type:"string",description:"Saved pipeline name"},input:{type:"string",description:"Input for the first step"}},required:["pipeline_name","input"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_save",description:"Save a new prompt pipeline.",parameters:{type:"object",properties:{name:{type:"string",description:"Pipeline name"},steps:{type:"string",description:"JSON array: [{\"prompt\":\"...\",\"model\":\"groq:llama-3.1-8b-instant\"},{...}]"},description:{type:"string",description:"Pipeline description"}},required:["name","steps"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_list",description:"List saved pipelines.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"model_route_set",description:"Add a model routing rule based on task type.",parameters:{type:"object",properties:{task_type:{type:"string",description:"Task type (e.g. code, vision, fast, creative)"},model:{type:"string",description:"Model to use (e.g. groq:openai/gpt-oss-120b, openai:gpt-5-mini)"},description:{type:"string",description:"Rule description"}},required:["task_type","model"],additionalProperties:false}}},
    {type:"function",function:{name:"model_route_list",description:"List existing model routing rules.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Phase 35: Voice Translation ─────────────────────────────────────────────────
    {type:"function",function:{name:"translation_start",description:"Start real-time voice translation mode. Automatically translates as the user speaks.",parameters:{type:"object",properties:{source_lang:{type:"string",description:"Source language code (tr, en, de, fr, es, ar, ru, zh...)"},target_lang:{type:"string",description:"Target language code"}},required:["source_lang","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"translation_stop",description:"Stop real-time translation mode.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"translate_text",description:"Translate the given text into the target language.",parameters:{type:"object",properties:{text:{type:"string",description:"Text to translate"},target_lang:{type:"string",description:"Target language code (tr, en, de, fr, es...)"},tone:{type:"string",enum:["formal","casual","technical"],description:"Translation tone"}},required:["text","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"translate_file",description:"Translate a .txt or .md file into the target language.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Path of the file to translate"},target_lang:{type:"string",description:"Target language code"}},required:["file_path","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"subtitle_toggle",description:"Turn the on-screen subtitle overlay on or off.",parameters:{type:"object",properties:{enable:{type:"boolean",description:"true=on, false=off"}},required:["enable"],additionalProperties:false}}},

    // ── Phase 36: Notification Monitor ────────────────────────────────────────────
    {type:"function",function:{name:"notification_recent",description:"Show the last N Windows notifications.",parameters:{type:"object",properties:{count:{type: "string",description:"How many notifications (default 20, max 100)"}},additionalProperties:false}}},
    {type:"function",function:{name:"notification_history",description:"Show the notification history recorded by AEGIS.",parameters:{type:"object",properties:{count:{type: "string",description:"How many notifications to show"}},additionalProperties:false}}},
    {type:"function",function:{name:"notification_filter_set",description:"Show or hide notifications from a specific app.",parameters:{type:"object",properties:{app:{type:"string",description:"App name (e.g. Spotify, WhatsApp, Teams)"},action:{type:"string",enum:["show","hide"],description:"show=display, hide=suppress"}},required:["app","action"],additionalProperties:false}}},
    {type:"function",function:{name:"notification_filter_list",description:"List saved notification filter rules.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"do_not_disturb",description:"Enable Do Not Disturb mode for the specified number of minutes.",parameters:{type:"object",properties:{minutes:{type: "string",description:"DND duration (minutes)"},off:{type:"boolean",description:"true to turn off DND"}},additionalProperties:false}}},

    // ── Phase 37: Code Builder & Test Runner ───────────────────────────────
    {type:"function",function:{name:"project_detect",description:"Detect the project type in a folder (Node.js, Rust, Python, Go, Java, etc.)",parameters:{type:"object",properties:{dir:{type:"string",description:"Project folder"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"build_project",description:"Build the project. Analyzes errors and suggests fixes.",parameters:{type:"object",properties:{dir:{type:"string",description:"Project folder"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"run_tests",description:"Run project tests. Summarizes the results.",parameters:{type:"object",properties:{dir:{type:"string",description:"Project folder"},test_file:{type:"string",description:"A specific test file (optional)"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"lint_project",description:"Run project lint checks.",parameters:{type:"object",properties:{dir:{type:"string",description:"Project folder"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"format_code",description:"Automatically format code (prettier, black, rustfmt, gofmt).",parameters:{type:"object",properties:{dir:{type:"string",description:"Project folder"}},required:["dir"],additionalProperties:false}}},

    // ── Phase 38: News & Price Tracking ─────────────────────────────────────────
    {type:"function",function:{name:"rss_add",description:"Add an RSS/Atom feed.",parameters:{type:"object",properties:{url:{type:"string",description:"Feed URL"},label:{type:"string",description:"Feed label"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"rss_remove",description:"Remove a feed.",parameters:{type:"object",properties:{url:{type:"string",description:"Feed URL or label"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"rss_list",description:"List saved feeds.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"rss_fetch",description:"Fetch and summarize recent news from saved feeds.",parameters:{type:"object",properties:{count:{type: "string",description:"Total number of news items (default 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"price_get",description:"Get stock or currency prices (Yahoo Finance). E.g. AAPL, GOOG, BIST:THYAO",parameters:{type:"object",properties:{symbols:{type:"string",description:"Comma-separated symbols (e.g. AAPL,TSLA)"}},required:["symbols"],additionalProperties:false}}},
    {type:"function",function:{name:"crypto_price",description:"Get cryptocurrency prices (CoinGecko). In USD and TRY.",parameters:{type:"object",properties:{coins:{type:"string",description:"Comma-separated coin names (e.g. bitcoin,ethereum,solana)"}},required:["coins"],additionalProperties:false}}},
    {type:"function",function:{name:"fx_rate",description:"Get exchange rates (exchangerate-api). E.g. USD/TRY, EUR/USD",parameters:{type:"object",properties:{pairs:{type:"string",description:"Comma-separated currency pairs (e.g. USD/TRY,EUR/TRY)"}},required:["pairs"],additionalProperties:false}}},
    {type:"function",function:{name:"price_alert_set",description:"Set a price alert. Sends a notification once the specified price is reached.",parameters:{type:"object",properties:{symbol:{type:"string",description:"Symbol (e.g. bitcoin, AAPL, USD/TRY)"},type:{type:"string",enum:["crypto","stock","fx"]},above:{type: "string",description:"Alert if it rises above this price"},below:{type: "string",description:"Alert if it drops below this price"}},required:["symbol","type"],additionalProperties:false}}},

    // ── Phase 39: Voice Meeting Assistant ─────────────────────────────────────
    {type:"function",function:{name:"meeting_start",description:"Start recording a meeting. Speech is transcribed.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_stop",description:"Stop and save the meeting recording.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_list",description:"List recorded meetings.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_summarize",description:"Summarize a meeting: decisions, action items, participants.",parameters:{type:"object",properties:{id:{type:"string",description:"Meeting ID (defaults to the latest meeting if left blank)"}},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_export",description:"Export the meeting as a .md file.",parameters:{type:"object",properties:{id:{type:"string",description:"Meeting ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"meeting_action_items",description:"Extract action items from a meeting.",parameters:{type:"object",properties:{id:{type:"string",description:"Meeting ID"}},required:["id"],additionalProperties:false}}},

    // ── Phase 40: Context-Aware Actions ─────────────────────────────────────
    {type:"function",function:{name:"get_active_context",description:"Detect the active app and context. Shows suggested tools.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"context_rule_set",description:"Define a custom suggestion or automatic action for when a specific app is open.",parameters:{type:"object",properties:{app_pattern:{type:"string",description:"Pattern to search for in the app name or window title"},suggestion:{type:"string",description:"Suggestion text"},auto_action:{type:"string",description:"Tool to run automatically (optional)"}},required:["app_pattern","suggestion"],additionalProperties:false}}},
    {type:"function",function:{name:"context_rule_list",description:"List context rules.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_watch",description:"Analyze clipboard content and offer suggestions.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_history",description:"Show clipboard history.",parameters:{type:"object",properties:{count:{type: "string",description:"How many entries to show (default 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_search",description:"Search the clipboard history.",parameters:{type:"object",properties:{query:{type:"string",description:"Text to search for"}},required:["query"],additionalProperties:false}}},

    // ── Phase 41: Powerful Local Search ──────────────────────────────────────────
    {type:"function",function:{name:"file_search",description:"Search the file system by file name (Everything or PowerShell).",parameters:{type:"object",properties:{query:{type:"string",description:"File name or pattern"},dir:{type:"string",description:"Folder to search (optional, default: home directory)"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"content_search",description:"Search for text inside files in a folder. Returns results with line numbers.",parameters:{type:"object",properties:{query:{type:"string",description:"Text or regex to search for"},dir:{type:"string",description:"Folder to search"},extension:{type:"string",description:"File extension filter (e.g. ts, py, md)"}},required:["query","dir"],additionalProperties:false}}},
    {type:"function",function:{name:"app_search",description:"Search for an app and launch it if needed. Supports fuzzy search.",parameters:{type:"object",properties:{query:{type:"string",description:"App name (partial is fine, e.g. 'chr' for Chrome)"},launch:{type:"boolean",description:"true to launch the best match"}},required:["query"],additionalProperties:false}}},

    // ── Phase 42: System Optimization ─────────────────────────────────────────
    {type:"function",function:{name:"kill_heavy_process",description:"List the heaviest CPU/RAM-consuming processes and optionally kill them.",parameters:{type:"object",properties:{top_n:{type: "string",description:"How many processes to list (default 3)"},confirm:{type:"boolean",description:"true to actually kill the processes"}},additionalProperties:false}}},
    {type:"function",function:{name:"suspend_process",description:"Lower a process's priority to Idle (similar to pausing it, doesn't free RAM).",parameters:{type:"object",properties:{name:{type:"string",description:"Process name"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"resume_process",description:"Restore a process's priority to Normal.",parameters:{type:"object",properties:{name:{type:"string",description:"Process name"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"clear_temp",description:"Clean Windows temp folders and report the freed space.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"flush_dns",description:"Clear the DNS cache.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"startup_manager",description:"List or disable Windows startup apps.",parameters:{type:"object",properties:{action:{type:"string",enum:["list","disable"],description:"list=show, disable=disable"},name:{type:"string",description:"App name to disable (for disable)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"perf_mode_start",description:"Start performance mode: power plan set to High Performance, background apps throttled.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"perf_mode_stop",description:"Stop performance mode and return to normal.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Phase 43: Workspace System ─────────────────────────────────────────────
    {type:"function",function:{name:"workspace_create",description:"Create a named workspace. Isolated with its own system prompt, model, and history.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace name"},description:{type:"string",description:"Workspace description"},system_prompt:{type:"string",description:"System prompt specific to this workspace"},model:{type:"string",description:"Default model (e.g. groq:qwen3-32b)"},working_dir:{type:"string",description:"Working directory for this workspace"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_switch",description:"Switch to a different workspace.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace name to switch to"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_list",description:"List available workspaces.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"workspace_delete",description:"Delete a workspace.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace name to delete"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_export",description:"Export a workspace as a JSON file.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace name"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_import",description:"Import a workspace from a JSON file.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Path to the exported JSON file"}},required:["file_path"],additionalProperties:false}}},

    // ── Phase 44: Reports & Analytics ──────────────────────────────────────────────
    {type:"function",function:{name:"daily_report",description:"Generate today's activity report: tool usage, time tracking, goal progress.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"weekly_report",description:"Generate a weekly activity report for the last 7 days.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"productivity_insights",description:"Personal productivity analysis: strengths, areas for improvement, and suggestions.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Phase 46: Spotify ──────────────────────────────────────────────────────────
export const spotifySchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"spotify_authorize",description:"Connect a Spotify account to AEGIS (done once on first use). Opens the Spotify login page in a browser.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_play",description:"Start/resume music on Spotify. If a specific song/artist is requested, give a 'query' (e.g. 'play killshot', 'change it to X', 'play X') → that song is searched and played. If left empty, resumes paused music.",parameters:{type:"object",properties:{query:{type:"string",description:"Optional: name of the song/artist to play. If not given, current music resumes."}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_pause",description:"Pause the music playing on Spotify.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_next",description:"Skip to the next track on Spotify.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_prev",description:"Go back to the previous track on Spotify.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_volume",description:"Set the Spotify volume level (0-100). Example: 20",parameters:{type:"object",properties:{level:{type: "string",description:"Volume level 0-100 (number, e.g. 50)"}},required:["level"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_now_playing",description:"Show what's currently playing on Spotify (track, artist, album, duration).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_open",description:"Open the Spotify app.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_search",description:"Search for and play a song/artist/album on Spotify.",parameters:{type:"object",properties:{query:{type:"string",description:"Search term (song name, artist, album)"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlists",description:"List the user's Spotify playlists.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_play_playlist",description:"Play the specified Spotify playlist (by name or ID).",parameters:{type:"object",properties:{name:{type:"string",description:"Playlist name (partial match) or Spotify playlist ID"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_like",description:"Like the currently playing song (add to Liked Songs).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_queue",description:"Add a song to the queue.",parameters:{type:"object",properties:{query:{type:"string",description:"Song name or artist to queue"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_devices",description:"List available Spotify devices.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_transfer",description:"Transfer playback to another device (phone, TV, computer).",parameters:{type:"object",properties:{device:{type:"string",description:"Device name or ID"}},required:["device"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_shuffle",description:"Turn shuffle mode on/off.",parameters:{type:"object",properties:{enabled:{type:"boolean",description:"true = on, false = off"}},required:["enabled"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_repeat",description:"Set repeat mode.",parameters:{type:"object",properties:{mode:{type:"string",enum:["off","track","context"],description:"off=off, track=repeat track, context=repeat playlist"}},required:["mode"],additionalProperties:false}}},

    // Player extras
    {type:"function",function:{name:"spotify_seek",description:"Seek to a specific position in the playing song (in milliseconds).",parameters:{type:"object",properties:{position_ms:{type: "string",description:"Position to seek to (ms). Example: 60000 = 1 minute"}},required:["position_ms"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_recently_played",description:"List recently played songs.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many songs (max 50, default 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_get_queue",description:"Show the Spotify play queue — currently playing + up-next songs.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // Albums
    {type:"function",function:{name:"spotify_get_album",description:"Get album details (name, artist, release date, track count). Requires an ID — if a name is given, call spotify_search first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify album ID. If you have a name, call spotify_search first."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_album_tracks",description:"List all tracks on an album. Requires an ID — if a name is given, call spotify_search first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify album ID. If you have a name, call spotify_search first."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_albums",description:"List saved albums in the library.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many albums (max 50, default 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_save_album",description:"Save an album to the library. Requires an ID — if you have a name, call spotify_search first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify album ID. If you have a name, call spotify_search first."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_remove_album",description:"Remove an album from the library. Requires an ID — if you have a name, call spotify_search first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify album ID. If you have a name, call spotify_search first."}},required:["id"],additionalProperties:false}}},

    // Artists
    {type:"function",function:{name:"spotify_get_artist",description:"Get artist info (followers, popularity, genres). Works with either an artist name or a Spotify ID — a name is searched automatically.",parameters:{type:"object",properties:{id:{type:"string",description:"Artist name (e.g. 'Radiohead') or Spotify ID (22 characters)"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_artist_top_tracks",description:"List an artist's most popular tracks. Accepts an artist name or ID — a name is searched automatically.",parameters:{type:"object",properties:{id:{type:"string",description:"Artist name (e.g. 'Thom Yorke') or Spotify ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_artist_albums",description:"List an artist's albums and singles. Accepts an artist name or ID.",parameters:{type:"object",properties:{id:{type:"string",description:"Artist name or Spotify ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_related_artists",description:"Find artists similar to a given artist. Accepts an artist name or ID.",parameters:{type:"object",properties:{id:{type:"string",description:"Artist name or Spotify ID"}},required:["id"],additionalProperties:false}}},

    // Tracks
    {type:"function",function:{name:"spotify_get_track",description:"Get track details (album, duration, popularity, URI). Requires a track ID — if a name is given, call spotify_search first to get the track_id.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify track ID. If you have a name, call spotify_search first."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_audio_features",description:"Get a track's musical features: tempo (BPM), energy, valence (mood), danceability, acousticness, key. For the currently playing track, get the track_id from spotify_now_playing first; for a specific track, call spotify_search first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify track ID. For the currently playing track, call spotify_now_playing first; for a specific track, call spotify_search first."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_recommendations",description:"Generate recommendations based on track/artist/genre seeds. BEST FLOW: first get track IDs via spotify_recently_played or spotify_now_playing, add them to seed_tracks comma-separated. For genre-based recommendations use seed_genres (no ID needed). seed_artists+seed_tracks+seed_genres combined must total at most 5.",parameters:{type:"object",properties:{seed_artists:{type:"string",description:"Comma-separated artist IDs. If you don't have an ID, get one via spotify_search."},seed_tracks:{type:"string",description:"Comma-separated track IDs. For recently played, call spotify_recently_played first."},seed_genres:{type:"string",description:"Comma-separated Spotify genre names (e.g. pop,rock,jazz,indie). No ID needed, use directly."},limit:{type: "string",description:"Number of recommendations (max 20, default 10)"}},additionalProperties:false}}},

    // Playlists extended
    {type:"function",function:{name:"spotify_get_playlist",description:"Get playlist details (owner, track count, URI). Requires an ID — for your own playlists, call spotify_playlists first; for someone else's playlist, call spotify_search first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify playlist ID. For your own playlists, call spotify_playlists first."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlist_tracks",description:"List the tracks in a playlist. Requires an ID — for your own playlists, call spotify_playlists first.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify playlist ID. For your own playlists, call spotify_playlists first."},limit:{type: "string",description:"How many tracks (max 50, default 20)"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_create_playlist",description:"Create a new Spotify playlist.",parameters:{type:"object",properties:{name:{type:"string",description:"Playlist name"},public:{type:"boolean",description:"Public? (default false)"},description:{type:"string",description:"Playlist description"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlist_add",description:"Add songs to a playlist (with a list of URIs).",parameters:{type:"object",properties:{playlist_id:{type:"string",description:"Spotify playlist ID"},uris:{type:"array",items:{type:"string"},description:"spotify:track:xxx URIs to add"}},required:["playlist_id","uris"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlist_remove",description:"Remove songs from a playlist (with a list of URIs).",parameters:{type:"object",properties:{playlist_id:{type:"string",description:"Spotify playlist ID"},uris:{type:"array",items:{type:"string"},description:"spotify:track:xxx URIs to remove"}},required:["playlist_id","uris"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_featured_playlists",description:"List Spotify's featured/recommended playlists.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // Library
    {type:"function",function:{name:"spotify_saved_tracks",description:"List liked songs (Liked Songs).",parameters:{type:"object",properties:{limit:{type: "string",description:"How many songs (max 50, default 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_check_saved_tracks",description:"Check whether the specified songs are liked.",parameters:{type:"object",properties:{ids:{type:"array",items:{type:"string"},description:"List of track IDs"}},required:["ids"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_shows",description:"List saved podcasts in the library.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many podcasts (default 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_episodes",description:"List saved podcast episodes in the library.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many episodes (default 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_audiobooks",description:"List saved audiobooks in the library.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many audiobooks (default 20)"}},additionalProperties:false}}},

    // User
    {type:"function",function:{name:"spotify_me",description:"Get profile info for the connected Spotify account (name, email, country, plan, followers).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_top_items",description:"Get the most-listened artists or tracks.",parameters:{type:"object",properties:{type:{type:"string",enum:["artists","tracks"],description:"artists = artists, tracks = tracks"},time_range:{type:"string",enum:["short_term","medium_term","long_term"],description:"short_term=last 4 weeks, medium_term=last 6 months, long_term=all time"},limit:{type: "string",description:"How many results (max 50, default 10)"}},required:["type"],additionalProperties:false}}},

    // Follow
    {type:"function",function:{name:"spotify_follow_artist",description:"Follow an artist. Works with either an artist name or a Spotify ID — a name is searched automatically.",parameters:{type:"object",properties:{id:{type:"string",description:"Artist name (e.g. 'Portishead') or Spotify ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_unfollow_artist",description:"Unfollow an artist. Accepts an artist name or Spotify ID.",parameters:{type:"object",properties:{id:{type:"string",description:"Artist name or Spotify ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_followed_artists",description:"List followed artists.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many artists (max 50, default 20)"}},additionalProperties:false}}},

    // Browse
    {type:"function",function:{name:"spotify_new_releases",description:"List new album and single releases on Spotify.",parameters:{type:"object",properties:{limit:{type: "string",description:"How many results (max 50, default 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_categories",description:"List Spotify music categories (genres).",parameters:{type:"object",properties:{limit:{type: "string",description:"How many categories (max 50, default 20)"}},additionalProperties:false}}},

    // Shows / Episodes / Audiobooks
    {type:"function",function:{name:"spotify_get_show",description:"Get podcast details.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify show/podcast ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_show_episodes",description:"List a podcast's episodes.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify show/podcast ID"},limit:{type: "string",description:"How many episodes (max 50, default 10)"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_get_episode",description:"Get podcast episode details.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify episode ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_get_audiobook",description:"Get audiobook details.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify audiobook ID"}},required:["id"],additionalProperties:false}}},
];

// ── Phase 46: Steam ────────────────────────────────────────────────────────────
export const steamSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"steam_launch",description:"Launch a Steam game. ALWAYS use this tool when the user wants to open a Steam game, do NOT use run_command. Give a game name or AppID. Opens Steam if it's closed.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name (e.g. 'Cyberpunk 2077', 'Dead by Daylight', 'dbd') or Steam AppID (e.g. '1091500')"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list",description:"List Steam games installed on this computer.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open",description:"Open the Steam app and bring it to the front.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_close",description:"Close Steam.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_running",description:"Is a game currently running via Steam, and if so, which one?",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Group A: Local / steam:// protocol (no key required) ──
    {type:"function",function:{name:"steam_restart",description:"Restart Steam (close and reopen).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_close_game",description:"Close the currently running Steam game.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name (optional; if omitted, closes the running game)"}},additionalProperties:false}}},
    {type:"function",function:{name:"steam_restart_game",description:"Close and relaunch a Steam game.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list_running_games",description:"List all currently running Steam games.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_is_game_running",description:"Check whether a specific game is currently running.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_install_game",description:"Start installing a Steam game (opens the Steam install dialog).",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_uninstall_game",description:"Uninstall a Steam game (opens the Steam uninstall dialog).",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_verify_game_files",description:"Verify the integrity of a game's files (Steam validate).",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_update_game",description:"Check for / start an update for a game.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_download_status",description:"Show whether there's an active download/update on Steam, and open the download manager.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_store_page",description:"Open a game's Steam store page.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_screenshots",description:"Open the Steam screenshot manager.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_show_storage_usage",description:"Show disk usage of installed Steam games (largest first).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_locate_installation",description:"Show the folder path where a game is installed.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_game_folder",description:"Open a game's install folder in Explorer.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_last_played_game",description:"Get the most recently played game (Web API).",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Group C: Storefront (no key required) ──
    {type:"function",function:{name:"steam_search_store",description:"Search for a game in the Steam store.",parameters:{type:"object",properties:{query:{type:"string",description:"Game name to search for"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_details",description:"Get a game's store details (description, genre, release, price).",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_price",description:"Get a game's current store price/discount.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_discounted_games",description:"List featured discounted games in the Steam store.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_news",description:"Get recent news for a game.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},

    // ── Group B: Web API (requires Steam API key + SteamID64) ──
    {type:"function",function:{name:"steam_owned_games",description:"List all owned Steam games with playtime. Requires Steam API key + SteamID.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_search_owned_games",description:"Search the library by game name. Requires Steam API key.",parameters:{type:"object",properties:{query:{type:"string",description:"Game name to search for"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_recent_games",description:"Get games played in the last 2 weeks. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_most_played_games",description:"Get the most-played games. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_playtime",description:"Get total playtime for a game. Requires Steam API key.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_total_playtime",description:"Calculate total Steam playtime across all games. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_suggest_game",description:"Suggest a game to play based on the library. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_achievements",description:"Get a game's achievements and which ones are unlocked. Requires Steam API key.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_achievement_progress",description:"Show achievement progress for a game as a percentage. Requires Steam API key.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_player_stats",description:"Get player stats for a game. Requires Steam API key.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_profile_summary",description:"Get a Steam profile summary (name, status, currently played game). Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_level",description:"Get your Steam level. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_friend_list",description:"Get your Steam friends list. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_online_friends",description:"List online Steam friends. Requires Steam API key.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_friend_current_game",description:"Show what game a friend is currently playing. Requires Steam API key.",parameters:{type:"object",properties:{friend:{type:"string",description:"Friend name or SteamID64"}},required:["friend"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_who_is_playing",description:"List friends playing a specific game. Requires Steam API key.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name"}},required:["game"],additionalProperties:false}}},

    // ── Group D: Experimental — Steam doesn't give full external control, opens a page/dialog ──
    {type:"function",function:{name:"steam_wishlist_add",description:"[EXPERIMENTAL] Add a game to the wishlist. Opens the store page and tries to auto-click the '+ Add to Wishlist' button via computer-use (since Steam has no silent API for this). Fragile; if it fails, the page stays open and can be added manually.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_wishlist_remove",description:"[EXPERIMENTAL] Remove a game from the wishlist. Opens the store page.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_wishlist_list",description:"[EXPERIMENTAL] Show your wishlist (if the profile is public).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_pause_download",description:"[EXPERIMENTAL] Pause a download — opens the download manager (Steam doesn't allow individual external control).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_resume_download",description:"[EXPERIMENTAL] Resume a download — opens the download manager.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_cancel_download",description:"[EXPERIMENTAL] Cancel a download — opens the download manager.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_workshop",description:"[EXPERIMENTAL] Open a game's Steam Workshop page.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID (optional)"}},additionalProperties:false}}},
    {type:"function",function:{name:"steam_subscribe_workshop",description:"[EXPERIMENTAL] Subscribe to a Workshop item — opens the item page.",parameters:{type:"object",properties:{item_id:{type:"string",description:"Workshop item ID"}},required:["item_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_unsubscribe_workshop",description:"[EXPERIMENTAL] Unsubscribe from a Workshop item — opens the item page.",parameters:{type:"object",properties:{item_id:{type:"string",description:"Workshop item ID"}},required:["item_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list_workshop_subscriptions",description:"[EXPERIMENTAL] List locally downloaded Workshop subscriptions.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name/AppID (optional filter)"}},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_chat",description:"[EXPERIMENTAL] Open a Steam chat window with a friend.",parameters:{type:"object",properties:{friend_id:{type:"string",description:"Friend's SteamID64"}},required:["friend_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_send_message",description:"[EXPERIMENTAL] Message a friend — opens the chat window (Steam doesn't allow automatic external messaging).",parameters:{type:"object",properties:{friend_id:{type:"string",description:"Friend's SteamID64"},message:{type:"string",description:"Message text"}},required:["friend_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_backup_game",description:"[EXPERIMENTAL] Back up a game — opens the Steam backup wizard.",parameters:{type:"object",properties:{game:{type:"string",description:"Game name or AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_restore_backup",description:"[EXPERIMENTAL] Restore a Steam backup — opens Steam (restore is done from the menu).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_take_screenshot",description:"[EXPERIMENTAL] Take a Steam screenshot (in-game F12). For a general screenshot, prefer the 'take screenshot' tool.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_repeat_last_action",description:"[EXPERIMENTAL] Repeat the last Steam action performed.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Phase 47: Computer Use ─────────────────────────────────────────────────
export const computerUseSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"mouse_move",description:"Move the mouse cursor to (x,y) on screen.",parameters:{type:"object",properties:{x:{type: "string"},y:{type: "string"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_click",description:"Perform a mouse click. Automatically moves to the position before clicking. button: left/right/middle. double: double-click. If verify='true', checks whether the screen changed after the click (blind-click check).",parameters:{type:"object",properties:{x:{type: "string"},y:{type: "string"},button:{type:"string",enum:["left","right","middle"]},double:{type:"boolean"},verify:{type:"string",description:"'true' verifies the screen changed after the click"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_scroll",description:"Scroll with the mouse wheel. direction: up/down. amount: number of steps (default 3).",parameters:{type:"object",properties:{x:{type: "string"},y:{type: "string"},direction:{type:"string",enum:["up","down"]},amount:{type: "string"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_drag",description:"Drag and drop from one point to another.",parameters:{type:"object",properties:{x1:{type: "string"},y1:{type: "string"},x2:{type: "string"},y2:{type: "string"}},required:["x1","y1","x2","y2"],additionalProperties:false}}},
    {type:"function",function:{name:"key_press",description:"Press a key or keyboard shortcut. Examples: 'ctrl+c', 'alt+tab', 'win+d', 'enter', 'esc', 'f5'.",parameters:{type:"object",properties:{keys:{type:"string",description:"Key combination, separated by '+' (e.g. 'ctrl+shift+t')"}},required:["keys"],additionalProperties:false}}},
    {type:"function",function:{name:"type_text",description:"Type text into the active field (as if typed on a keyboard).",parameters:{type:"object",properties:{text:{type:"string",description:"Text to type"}},required:["text"],additionalProperties:false}}},
    {type:"function",function:{name:"computer_use",description:"Accomplish a goal by taking screenshots and analyzing them with AI. Uses the mouse+keyboard to operate the computer. For free-form commands like 'play this song on Spotify', 'open this site in Chrome', 'find and delete this file'.",parameters:{type:"object",properties:{goal:{type:"string",description:"What you want to do (free-form language, e.g. 'open Chrome and go to youtube.com')"},max_steps:{type: "string",description:"Maximum number of steps (default 10)"}},required:["goal"],additionalProperties:false}}},
    {type:"function",function:{name:"screen_size",description:"Get the screen resolution (may be needed for mouse_click coordinates).",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Phase 7.3: Google (Gmail + Calendar via OAuth) ────────────────────────────
export const googleSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"google_authorize",description:"Connect a Google account to AEGIS for Gmail and Calendar (done once). Opens the Google consent page in a browser. Requires the Client ID/Secret set in Settings → API Keys.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"google_status",description:"Show whether a Google account is connected and which mailbox it is.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"google_disconnect",description:"Disconnect the linked Google account and delete the stored token.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"gmail_list",description:"List recent emails from Gmail. Supports Gmail search syntax in 'query' (e.g. 'is:unread', 'from:boss@x.com', 'subject:invoice newer_than:7d'). Default: inbox.",parameters:{type:"object",properties:{query:{type:"string",description:"Gmail search query (optional, default 'in:inbox')"},limit:{type:"string",description:"How many emails (1-25, default 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"gmail_read",description:"Read the full body of one email by its ID (IDs come from gmail_list).",parameters:{type:"object",properties:{id:{type:"string",description:"Gmail message ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"gmail_send",description:"Send an email from the connected Gmail account. Use ONLY when the user explicitly asks to send an email.",parameters:{type:"object",properties:{to:{type:"string",description:"Recipient email address"},subject:{type:"string",description:"Subject line"},body:{type:"string",description:"Plain-text email body"}},required:["to","subject","body"],additionalProperties:false}}},
    {type:"function",function:{name:"calendar_events",description:"List upcoming Google Calendar events (primary calendar).",parameters:{type:"object",properties:{days:{type:"string",description:"How many days ahead to look (1-60, default 7)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_create_event",description:"Create a Google Calendar event. 'start' is an ISO datetime (2026-07-10T14:00:00) for timed events or YYYY-MM-DD for all-day.",parameters:{type:"object",properties:{summary:{type:"string",description:"Event title"},start:{type:"string",description:"Start: ISO datetime or YYYY-MM-DD (all-day)"},end:{type:"string",description:"End (optional; default 1 hour after start)"},description:{type:"string",description:"Details (optional)"},location:{type:"string",description:"Location (optional)"}},required:["summary","start"],additionalProperties:false}}},
    {type:"function",function:{name:"calendar_delete_event",description:"Delete a Google Calendar event by ID (IDs come from calendar_events).",parameters:{type:"object",properties:{id:{type:"string",description:"Event ID"}},required:["id"],additionalProperties:false}}},
];

export const extraSchemas: ChatCompletionTool[] = [];
