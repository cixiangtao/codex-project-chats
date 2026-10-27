/** Shared extension and webview messages; no VS Code runtime dependency. */
const english = {
  "viewTitle": "Project Chats",
  "scope": "Conversation scope",
  "current": "Current project",
  "all": "All projects",
  "search": "Search conversation titles",
  "refresh": "Refresh conversations",
  "reading": "Loading conversations…",
  "groups": "Conversations grouped by project",
  "viewAll": "View all projects",
  "retry": "Retry",
  "more": "Load more conversations",
  "loading": "Loading…",
  "currentBadge": "Current",
  "unknownTime": "Unknown",
  "now": "Just now",
  "minutesAgo": "{count}m ago",
  "hoursAgo": "{count}h ago",
  "yesterday": "Yesterday",
  "daysAgo": "{count}d ago",
  "recentConversation": "Recent conversation",
  "path": "Path",
  "opening": "Opening…",
  "openingLabel": "{title}, opening in Codex",
  "openLabel": "{title}, recent conversation: {time}, open in Codex",
  "projectsOne": "{count} project",
  "projectsOther": "{count} projects",
  "chatsOne": "{count} chat",
  "chatsOther": "{count} chats",
  "loadedOne": "{count} loaded chat",
  "loadedOther": "{count} loaded chats",
  "emptyWorkspaceTitle": "Open a project folder first",
  "emptySearchTitle": "No matching conversations",
  "emptyTitle": "No conversations yet",
  "emptyWorkspaceDetail": "Open a project to see its conversations, or browse all projects.",
  "emptySearchDetail": "Try another title keyword or clear the search.",
  "emptyCurrentDetail": "Only conversations whose working directory matches a workspace root are shown. Switch to All projects to browse other directories.",
  "emptyAllDetail": "Create a conversation in the official Codex extension, then refresh.",
  "footer": "Select a conversation to continue in official Codex",
  "untitled": "Untitled conversation",
  "errorAbsolutePath": "The Codex path must be an absolute path on the current host.",
  "errorInstallOfficial": "Install and enable the official Codex extension first.",
  "errorWsl": "Open this project in a VS Code WSL window to use Project Chats.",
  "errorArchitecture": "Set the Codex executable path manually for this host architecture.",
  "errorBinaryMissing": "The bundled Codex executable was not found. Set its path in the extension settings.",
  "errorReadFailed": "Could not load conversations. Refresh to retry.",
  "errorOpenFailed": "Could not open the official Codex conversation. Open Codex and retry; an upstream update may have changed the navigation route.",
  "copyId": "Copy conversation ID",
  "errorDisconnected": "The Codex connection was lost. Refresh to retry.",
  "errorRequestFailed": "The Codex API request failed.",
  "errorStartFailed": "Could not start Codex. Check the official extension or the Codex executable path.",
  "errorExited": "The Codex list service exited. Refresh to retry.",
  "errorUnavailable": "The Codex list service is unavailable. Refresh to retry.",
  "errorTimeout": "Loading conversations timed out. Refresh to retry.",
  "errorConnectFailed": "Could not connect to the Codex list service.",
  "errorClosed": "The conversation list connection was closed.",
  "errorInvalidResponse": "Codex returned an unrecognized conversation list format.",
  "errorInvalidId": "The conversation ID format is invalid.",
  "errorEnableOfficial": "Enable the official Codex extension first.",
  "errorRouteRejected": "The official Codex extension did not accept the sidebar navigation request."
} as const;

export type MessageKey = keyof typeof english;
export type Messages = Record<MessageKey, string>;
export type Localize = (key: MessageKey, values?: Record<string, string | number>) => string;

const chinese: Messages = {
  "viewTitle": "项目对话",
  "scope": "对话范围",
  "current": "当前项目",
  "all": "全部项目",
  "search": "搜索对话标题",
  "refresh": "刷新对话",
  "reading": "正在读取对话…",
  "groups": "按项目分组的对话",
  "viewAll": "查看全部项目",
  "retry": "重新读取",
  "more": "加载更多对话",
  "loading": "正在加载…",
  "currentBadge": "当前",
  "unknownTime": "时间未知",
  "now": "刚刚",
  "minutesAgo": "{count}分钟前",
  "hoursAgo": "{count}小时前",
  "yesterday": "昨天",
  "daysAgo": "{count}天前",
  "recentConversation": "最近对话",
  "path": "路径",
  "opening": "打开中…",
  "openingLabel": "{title}，正在打开 Codex",
  "openLabel": "{title}，最近对话：{time}，在 Codex 中打开",
  "projectsOne": "{count} 个项目",
  "projectsOther": "{count} 个项目",
  "chatsOne": "{count} 条对话",
  "chatsOther": "{count} 条对话",
  "loadedOne": "{count} 条已加载",
  "loadedOther": "{count} 条已加载",
  "emptyWorkspaceTitle": "先打开一个项目文件夹",
  "emptySearchTitle": "没有匹配的对话",
  "emptyTitle": "这里还没有对话",
  "emptyWorkspaceDetail": "打开项目后自动显示相关对话，也可以先浏览全部项目。",
  "emptySearchDetail": "试试其他标题关键词，或清空搜索。",
  "emptyCurrentDetail": "只显示工作目录与当前项目根目录相同的对话。可切换全部项目查看其他目录。",
  "emptyAllDetail": "使用官方 Codex 创建对话后，点击刷新。",
  "footer": "点击对话，在官方 Codex 中继续",
  "untitled": "未命名对话",
  "errorAbsolutePath": "Codex 路径必须是当前主机的绝对路径。",
  "errorInstallOfficial": "请先安装并启用官方 Codex 扩展。",
  "errorWsl": "请在 VS Code 的 WSL 窗口中打开项目，再使用项目对话。",
  "errorArchitecture": "此主机架构需要手动设置 Codex 可执行文件路径。",
  "errorBinaryMissing": "未找到官方内置 Codex。请在扩展设置中指定 Codex 可执行文件路径。",
  "errorReadFailed": "读取对话失败，请刷新重试。",
  "errorOpenFailed": "未能打开官方 Codex 对话。可先打开 Codex 后重试；官方更新也可能影响跳转入口。",
  "copyId": "复制会话 ID",
  "errorDisconnected": "Codex 连接已断开，请刷新重试。",
  "errorRequestFailed": "Codex 接口请求失败。",
  "errorStartFailed": "无法启动 Codex。请检查官方扩展或 Codex 可执行文件路径。",
  "errorExited": "Codex 列表服务已退出，请刷新重试。",
  "errorUnavailable": "Codex 列表服务不可用，请刷新重试。",
  "errorTimeout": "读取对话超时，请刷新重试。",
  "errorConnectFailed": "无法连接 Codex 列表服务。",
  "errorClosed": "对话列表连接已关闭。",
  "errorInvalidResponse": "Codex 返回了无法识别的列表格式。",
  "errorInvalidId": "会话 ID 格式不正确。",
  "errorEnableOfficial": "请先启用官方 Codex 扩展。",
  "errorRouteRejected": "官方 Codex 未接受侧栏跳转请求。"
};

/** Match supported display languages; all other languages fall back to English. */
export function localization(language = 'en'): { locale: 'en' | 'zh-CN'; messages: Messages } {
  const chineseLanguage = /^zh(?:-|$)/i.test(language);
  return { locale: chineseLanguage ? 'zh-CN' : 'en', messages: chineseLanguage ? chinese : english };
}

/** Format only extension-owned copy; user titles and upstream errors remain unchanged. */
export function createLocalizer(language = 'en'): Localize {
  const { messages } = localization(language);
  return (key, values = {}) => messages[key].replace(/\{(\w+)\}/g,
    (placeholder, name: string) => values[name] === undefined ? placeholder : String(values[name]));
}

/** Embed the shared messages as inert JSON without allowing HTML script termination. */
export function serializeLocalization(language = 'en'): string {
  return JSON.stringify(localization(language)).replaceAll('<', '\\u003c');
}
