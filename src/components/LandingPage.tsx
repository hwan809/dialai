import {
  ArrowRight,
  Check,
  ChatCircleDots,
  PhoneCall,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { McpConnectCard } from "./McpConnectCard";

const steps = [
  { number: "01", title: "할 일을 말해주세요", description: "자연어로 예약 요청을 남기면 필요한 정보를 대화로 확인합니다." },
  { number: "02", title: "DialAI가 전화합니다", description: "ARS를 지나 상담사와 대화하고 통화 과정을 실시간으로 보여줍니다." },
  { number: "03", title: "결과만 확인하세요", description: "처리 결과와 요약, 전체 통화 내용을 한 화면에서 확인합니다." },
] as const;

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-container landing-nav__inner">
          <Link href="/" className="landing-brand" aria-label="DialAI 홈">
            <span className="brand-mark" aria-hidden><PhoneCall size={18} weight="bold" /></span>
            <span>DialAI</span>
          </Link>
          <nav className="landing-nav__links" aria-label="페이지 메뉴">
            <a href="#how-it-works">이용 방법</a>
            <a href="#codex">Codex 연결</a>
            <a href="#control">사용자 개입</a>
            <a href="#mvp-scope">MVP 범위</a>
          </nav>
          <Link href="/call" className="landing-cta landing-cta--small">전화 맡기기</Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-eyebrow">기다리는 시간을 돌려드립니다</p>
              <h1>전화는 DialAI가 할게요.<br />결과만 확인하세요.</h1>
              <p className="landing-hero__description">
                해야 할 일을 말하면 AI가 필요한 내용을 확인하고 직접 전화합니다.
                상담 과정은 실시간으로 보고, 중요한 결정은 언제든 직접 내릴 수 있어요.
              </p>
              <div className="landing-actions">
                <Link href="/call" className="landing-cta">전화 맡기기 <ArrowRight size={18} /></Link>
                <a href="#how-it-works" className="landing-secondary">어떻게 작동하나요?</a>
              </div>
              <p className="landing-caption"><Check size={16} weight="bold" /> 회원가입 없이 데모를 바로 체험할 수 있어요.</p>
            </div>

            <div className="hero-preview" aria-label="DialAI 전화 대행 미리보기">
              <div className="hero-preview__top">
                <span className="hero-preview__avatar"><PhoneCall size={18} weight="fill" /></span>
                <div><strong>한강식당 예약</strong><small>DialAI가 처리 중</small></div>
                <span className="hero-preview__status">상담 중</span>
              </div>
              <div className="hero-preview__messages">
                <p className="preview-message preview-message--user">오늘 저녁 7시에 두 명 예약해줘</p>
                <div className="preview-message preview-message--assistant">
                  <ChatCircleDots size={19} />
                  <p>좋아요. 매장에 전화해서 예약 가능 여부를 확인할게요.</p>
                </div>
              </div>
              <ol className="hero-preview__steps">
                <li className="is-complete">요청 확인</li>
                <li className="is-complete">전화 연결</li>
                <li className="is-current">상담 진행</li>
              </ol>
            </div>
          </div>
        </section>

        <section id="codex" className="landing-section landing-section--codex">
          <div className="landing-container mcp-connect-grid">
            <div className="mcp-connect-copy">
              <p className="landing-eyebrow">Codex MCP</p>
              <h2>한 줄로 Codex에<br />전화 능력을 더하세요.</h2>
              <p>명령을 한 번 붙여넣으면 Codex가 업체를 검색하고, 공개 전화번호를 확인한 뒤 DialAI를 통해 전화를 맡길 수 있습니다.</p>
              <ul>
                <li><Check size={17} weight="bold" /> 사용자 기기에 worker 설치 불필요</li>
                <li><Check size={17} weight="bold" /> 연결 확인 성공 후에만 Codex 실행</li>
                <li><Check size={17} weight="bold" /> 키는 한 번만 표시하고 서버에는 해시만 저장</li>
              </ul>
            </div>
            <McpConnectCard />
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="landing-container">
            <div className="landing-section__heading">
              <p className="landing-eyebrow">이용 방법</p>
              <h2>전화 한 통을 맡기는 가장 간단한 방법</h2>
            </div>
            <ol className="process-row">
              {steps.map((step) => (
                <li key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="control" className="landing-section landing-section--soft">
          <div className="landing-container control-grid">
            <div className="control-copy">
              <span className="control-icon" aria-hidden><ShieldCheck size={26} weight="fill" /></span>
              <p className="landing-eyebrow">결정권은 사용자에게</p>
              <h2>AI가 임의로 정하지 않아요.</h2>
              <p>예상하지 못한 선택이 필요하면 통화를 멈추고 사용자에게 묻습니다. 선택을 받으면 같은 통화를 이어서 진행합니다.</p>
            </div>
            <div className="control-question">
              <span>사용자의 확인이 필요해요</span>
              <h3>상담사가 오후 7시 30분을 제안했습니다.</h3>
              <p>원하는 답을 선택하면 DialAI가 바로 통화를 이어갑니다.</p>
              <button type="button">오후 7시 30분으로 예약</button>
              <button type="button">이번 예약은 진행하지 않기</button>
            </div>
          </div>
        </section>

        <section id="mvp-scope" className="landing-scope">
          <div className="landing-container landing-scope__inner">
            <p><strong>현재 MVP 범위</strong> 실제로 체험 가능한 데모는 식당 예약 전화에 집중되어 있습니다.</p>
            <span>향후 병원, 통신사, 공과금 문의로 확장할 예정입니다.</span>
          </div>
        </section>

        <section className="landing-closing">
          <div className="landing-container">
            <p className="landing-eyebrow">이제 기다리지 마세요</p>
            <h2>첫 번째 전화를<br />DialAI에게 맡겨보세요.</h2>
            <Link href="/call" className="landing-cta">무료 데모 시작 <ArrowRight size={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container"><span>DialAI</span><p>AI 전화 대행 에이전트 MVP</p></div>
      </footer>
    </div>
  );
}
