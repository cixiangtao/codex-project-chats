# Codex Project Chats

[English](README.md) · 简体中文

一个只做项目分类和跳转的 VS Code 扩展。打开项目，看到相关 Codex 对话，点一下回到官方 Codex。

> 预览版本；目前仅对 macOS Apple Silicon 完成端到端验证。界面为中文。

## 使用

1. 安装并登录官方 **Codex** 扩展（`openai.chatgpt`）。
2. 在 VS Code 扩展商店搜索 `@id:cixiangtao.codex-project-chats`，安装 **Codex Project Chats**（发布者：`cixiangtao`）。也可通过 **扩展 → … → 从 VSIX 安装** 安装离线包。
3. 打开项目文件夹，点击活动栏的 **Codex 项目对话** 图标。
4. 顶部直接选择 **当前项目 / 全部项目**，在搜索框输入标题关键词。
5. 展开项目，点击对话，在已有的官方 Codex 对话区中继续。如果你把 Codex 放在右侧，就在右侧切换，不新建中间编辑器标签页。

命令面板也可执行 **Codex Project Chats: 打开项目对话**。

当前项目与保存的 `cwd` 精确匹配，兼顾工作区符号链接的真实路径；多根工作区匹配全部根目录。子目录和 worktree 分别分组。没有打开文件夹时可直接查看全部项目。同名目录显示路径。

每页加载 50 条，分类计数是当前已加载数量；用“加载更多对话”继续。目录筛选与标题搜索在服务端分页前执行，因此不会只搜索第一批对话。只展示未归档、交互式本地会话，不展示子代理和批处理会话。展开状态在视图恢复期间保留，范围选择按工作区保存。

## 界面预览

以下均为示例数据，不含真实会话。

![当前项目](https://raw.githubusercontent.com/cixiangtao/codex-project-chats/main/docs/images/current-project.png)

![全部项目](https://raw.githubusercontent.com/cixiangtao/codex-project-chats/main/docs/images/all-projects.png)

## 边界与兼容

- 不修改官方扩展，不修改会话内容，不读取账号凭据，不发送提示词。
- 通过官方内置 Codex 的 `app-server` 子进程读取 `thread/list`；使用 `useStateDbOnly` 避免扫描修复历史。服务可能自行产生运行日志和维护内部状态，本扩展不直接操作 Codex 数据库。
- 只向面板传递会话 ID、标题（无标题时采用首条消息摘要）、cwd 和更新时间；不读取或渲染完整对话。
- 不实现归档、删除、标签、自定义分类或聊天功能。可见分类是目录分组，不是权限隔离。
- 跳转先由 `vscode.env.asExternalUri` 为 `vscode://openai.chatgpt/local/<id>` 生成绑定当前窗口的地址，再唤起官方侧栏并交给其 URI 处理器。遵循已有 Codex 对话区的位置，不新建编辑器标签页。官方 URI 路径未承诺稳定，需要在官方更新后验证。
- 运行在 workspace extension host。WSL、SSH 和容器需要在相应远程窗口安装本扩展与官方 Codex；跨主机历史不合并。本地 Windows 窗口把 Codex 重定向到 WSL 的混合模式不支持，请打开 WSL 窗口。
- 首版已针对 macOS Apple Silicon 验证；其他平台路径经过代码处理，未承诺完成端到端验证。
- 官方内置可执行文件布局若变化，可在用户设置中指定 `codexProjectChats.cliPath` 的绝对路径。
- 本扩展是独立的第三方项目，并非 OpenAI 官方产品。预览版已验证 macOS Apple Silicon，欢迎在确认兼容后使用。

## 从原型迁移

如果已经安装发布者为 `ikun-local` 的本地原型，请先卸载原型，再安装商店版本，避免两个扩展同时贡献相同的项目对话视图。Codex 对话保存在官方服务中，卸载本扩展不会删除对话。

## 反馈与贡献

- 普通问题请提交 [GitHub Issue](https://github.com/cixiangtao/codex-project-chats/issues)。
- 安全漏洞请使用[私密安全报告](https://github.com/cixiangtao/codex-project-chats/security/advisories/new)，不要公开会话记录或凭据。
- 参与开发请参阅 [CONTRIBUTING.md](https://github.com/cixiangtao/codex-project-chats/blob/main/CONTRIBUTING.md)。采用 [MIT 许可](https://github.com/cixiangtao/codex-project-chats/blob/main/LICENSE)。

## 自动发布

[发布工作流](https://github.com/cixiangtao/codex-project-chats/blob/main/docs/releasing.md)负责生成版本 PR，并且只在该版本 PR 通过 CI 且合并后上传 Marketplace。当前需先配置专用 GitHub App 和微软 Entra 身份，完成前保持停用。不会创建 GitHub Release，也不会发布 npm 包。

## 开发

需要 Node.js 22+。

```sh
npm ci
npm test
npm run package
```

源码不包含运行时 npm 依赖。TypeScript 编译到 `dist/`，VSIX 仅包含运行所需文件。

## 接口参考

- [官方 App Server](https://learn.chatgpt.com/docs/app-server)
- [VS Code Webview View](https://code.visualstudio.com/api/extension-guides/webview)

独立实现；没有复制 History Viewer 的代码。
