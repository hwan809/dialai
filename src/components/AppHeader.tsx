import { List, PhoneCall } from "@phosphor-icons/react/dist/ssr";
import { StatusBadge } from "./ui/StatusBadge";

type AppHeaderProps = {
  readonly demoMode?: boolean;
  readonly onMenuClick?: () => void;
};

export function AppHeader({ demoMode = false, onMenuClick = () => undefined }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="mobile-brand-lockup">
          <span className="brand-mark" aria-hidden>
            <PhoneCall size={18} weight="bold" />
          </span>
          <span>DialAI</span>
        </div>
        <div className="app-header__title">AI 전화 대행</div>
        <div className="app-header__actions">
          {demoMode && <StatusBadge>데모 모드</StatusBadge>}
          <button type="button" className="mobile-menu-button" onClick={onMenuClick} aria-label="메뉴 열기">
            <List size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
