import {
  ClockCounterClockwise,
  GearSix,
  House,
  PhoneCall,
  Plus,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const recentCalls = [
  { label: "한강식당 예약", meta: "오늘" },
  { label: "오마카세 예약", meta: "어제" },
] as const;

type AppSidebarProps = {
  readonly mobileOpen: boolean;
  readonly onClose: () => void;
  readonly onNewCall: () => void;
};

export function AppSidebar({ mobileOpen, onClose, onNewCall }: AppSidebarProps) {
  return (
    <aside className={`app-sidebar${mobileOpen ? " app-sidebar--open" : ""}`} aria-label="주요 메뉴">
      <div className="app-sidebar__top">
        <div className="app-sidebar__brand">
          <span className="brand-mark" aria-hidden>
            <PhoneCall size={18} weight="bold" />
          </span>
          <span>DialAI</span>
        </div>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="메뉴 닫기">
          <X size={20} />
        </button>
      </div>

      <button type="button" className="new-call-button" onClick={onNewCall}>
        <Plus size={18} weight="bold" />
        새 전화
      </button>

      <nav className="app-sidebar__nav">
        <Link href="/">
          <House size={19} weight="fill" />
          홈
        </Link>
        <a href="#recent-calls">
          <ClockCounterClockwise size={19} />
          통화 기록
        </a>
      </nav>

      <section id="recent-calls" className="recent-calls" aria-labelledby="recent-heading">
        <h2 id="recent-heading">최근 전화</h2>
        <ul>
          {recentCalls.map((call) => (
            <li key={call.label}>
              <button type="button">
                <span>{call.label}</span>
                <small>{call.meta}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="sidebar-settings">
        <GearSix size={19} />
        설정
      </button>
    </aside>
  );
}
