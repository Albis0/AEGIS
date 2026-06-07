export type ToolLine = {name: string; status: "running" | "done"; detail?: string};
export type Attachment = {name: string; url: string; mime: string; data: string};

export type FeedItem =
    | {id: string; kind: "user"; text: string; attachments?: Attachment[]}
    | {id: string; kind: "assistant"; text: string; tools: ToolLine[]}
    | {id: string; kind: "error"; text: string};
