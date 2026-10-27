import type { ProjectGroup } from '../../src/model';

/** Synthetic metadata only; never read local conversations for interface development. */
export function sampleGroups(locale: string): ProjectGroup[] {
  const root = '/projects/codex-project-chats';
  const now = Math.floor(Date.now() / 1000);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0);
  const englishTitles: Record<string, string> = {
    'thread-0001': 'Refine compact rows and conversation details',
    'thread-0002': 'Fix sidebar search and pagination',
    'thread-0003': 'Check Codex navigation and sidebar placement',
    'thread-0009': 'Document installation and everyday use',
    'thread-0010': 'Review directory matching in multi-root workspaces',
    'thread-0011': 'Review last year’s compatibility notes',
    'thread-0004': 'Adjust homepage navigation',
    'thread-0005': 'Improve the mobile layout',
    'thread-0006': 'Investigate the sign-in endpoint',
    'thread-0007': 'Check the company project build',
    'thread-0008': 'Organize personal project settings',
  };
  const chats = [
    ['thread-0001', root, '调整对话列表的紧凑布局与悬停详情', now - 180],
    ['thread-0002', root, '修复侧栏搜索与分页', now - 3600],
    ['thread-0003', root, '检查官方 Codex 跳转入口与侧栏位置兼容性', now - 7200],
    ['thread-0009', root, '整理扩展的安装与使用说明', Math.floor(yesterday.getTime() / 1000)],
    ['thread-0010', root, '排查多根工作区的目录匹配', now - 864000],
    ['thread-0011', root, '整理上一年度的兼容性记录', Math.floor(new Date(new Date().getFullYear() - 1, 11, 18).getTime() / 1000)],
    ['thread-0004', '/projects/website', '调整首页导航', now - 10000],
    ['thread-0005', '/projects/website', '优化移动端布局', now - 20000],
    ['thread-0006', '/projects/api-service', '排查登录接口', now - 40000],
    ['thread-0007', '/projects/company/app', '检查公司项目构建', now - 50000],
    ['thread-0008', '/projects/personal/app', '整理个人项目配置', now - 60000],
  ] satisfies [string, string, string, number][];
  const groups = new Map<string, ProjectGroup>();
  for (const [id, cwd, title, updatedAt] of chats) {
    let group = groups.get(cwd);
    if (!group) {
      group = { key: cwd, cwd, name: cwd.split('/').at(-1) || cwd, current: cwd === root, chats: [] };
      groups.set(cwd, group);
    }
    group.chats.push({ id, cwd, title: locale === 'en' ? englishTitles[id] || title : title, updatedAt });
  }
  return [...groups.values()];
}
