import type { ProjectGroup as Group } from '../../../../src/model';
import { useStrings } from '../../i18n/context';
import { ConversationRow, type ConversationRowProps } from './ConversationRow';

interface GroupProps extends Omit<ConversationRowProps, 'chat'> {
  group: Group;
  open: boolean;
  duplicate: boolean;
  searching: boolean;
  setOpen: (key: string, open: boolean) => void;
}
export function ProjectGroup({ group, open, duplicate, searching, setOpen, ...row }: GroupProps) {
  const { t } = useStrings();
  return (
    <details
      data-key={group.key}
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (searching || next === open) return;
        row.tooltip.hide();
        setOpen(group.key, next);
      }}
    >
      <summary title={group.cwd}>
        <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
        <span className="project-labels">
          <span className="project-name">{group.name}</span>
          {duplicate ? (
            <span className="path" title={group.cwd}>
              {group.cwd}
            </span>
          ) : null}
        </span>
        {group.current ? <span className="current-label">{t('currentBadge')}</span> : null}
        <span className="count">{group.chats.length}</span>
      </summary>
      {group.chats.map((chat) => (
        <ConversationRow key={chat.id} chat={chat} {...row} />
      ))}
    </details>
  );
}
