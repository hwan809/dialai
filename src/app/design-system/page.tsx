"use client";

import { Microphone, PhoneCall } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "@/components/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { ChoiceQuestion } from "@/components/ui/ChoiceQuestion";
import { Field } from "@/components/ui/Field";
import { ProgressRail } from "@/components/ui/ProgressRail";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Surface } from "@/components/ui/Surface";
import { Transcript } from "@/components/ui/Transcript";

const steps = [
  { id: "ready", label: "요청 확인" },
  { id: "dialing", label: "전화 연결" },
  { id: "conversation", label: "상담 진행" },
] as const;

export default function DesignSystemPage() {
  return (
    <div className="app-shell">
      <AppHeader demoMode />
      <main className="page-frame">
        <div className="screen-stack">
          <header className="screen-header">
            <p className="screen-kicker">디자인 시스템</p>
            <h1 className="screen-title">DialAI UI 프리미티브</h1>
            <p className="screen-description">
              요청, 통화 진행, 사용자 확인, 결과 화면에 공통으로 사용하는 상태를 확인합니다.
            </p>
          </header>

          <section className="showcase-section" aria-labelledby="showcase-buttons">
            <h2 id="showcase-buttons" className="showcase-title">버튼</h2>
            <div className="action-row">
              <Button leadingIcon={<PhoneCall size={18} />}>전화 시작</Button>
              <Button variant="secondary">수정하기</Button>
              <Button variant="quiet">나중에</Button>
              <Button variant="danger">요청 취소</Button>
              <Button disabled>사용 불가</Button>
              <Button loading>준비 중</Button>
              <IconButton label="마이크로 말하기">
                <Microphone size={20} />
              </IconButton>
            </div>
          </section>

          <section className="showcase-section" aria-labelledby="showcase-fields">
            <h2 id="showcase-fields" className="showcase-title">입력</h2>
            <div className="showcase-grid">
              <Field htmlFor="showcase-default" label="전화 대상" help="기관명 또는 매장명을 입력해주세요.">
                <input id="showcase-default" className="field-control" placeholder="예: 한강식당" />
              </Field>
              <Field htmlFor="showcase-error" label="전화번호" error="한국 전화번호 형식을 확인해주세요.">
                <input id="showcase-error" className="field-control" defaultValue="123" aria-invalid />
              </Field>
              <Field htmlFor="showcase-disabled" label="확인된 예약자">
                <input id="showcase-disabled" className="field-control" defaultValue="홍길동" disabled />
              </Field>
            </div>
          </section>

          <section className="showcase-section" aria-labelledby="showcase-status">
            <h2 id="showcase-status" className="showcase-title">상태</h2>
            <div className="action-row">
              <StatusBadge>전화 내용을 확인하고 있어요</StatusBadge>
              <StatusBadge tone="info">전화를 연결하고 있어요</StatusBadge>
              <StatusBadge tone="warning">사용자 확인이 필요해요</StatusBadge>
              <StatusBadge tone="success">상담사와 통화 중이에요</StatusBadge>
              <StatusBadge tone="error">업무를 완료하지 못했어요</StatusBadge>
            </div>
            <Surface>
              <ProgressRail currentId="dialing" steps={steps} />
            </Surface>
          </section>

          <section className="showcase-section" aria-labelledby="showcase-surfaces">
            <h2 id="showcase-surfaces" className="showcase-title">결과와 대화</h2>
            <div className="showcase-grid">
              <Surface tone="success">요청한 일정으로 예약이 완료됐어요.</Surface>
              <Surface tone="warning">상담사가 다른 시간을 제안했습니다.</Surface>
              <Surface tone="error">전화 연결에 실패했습니다. 번호를 확인해주세요.</Surface>
            </div>
            <Surface>
              <Transcript
                messages={[
                  { at: "00:03", role: "assistant", text: "안녕하세요. 예약 문의드리려고 전화했습니다." },
                  { at: "00:06", role: "user", text: "네, 원하시는 시간을 말씀해주세요." },
                ]}
              />
            </Surface>
            <Surface tone="subtle">
              <Transcript messages={[]} />
            </Surface>
            <Surface tone="warning">
              <ChoiceQuestion
                question="상담사가 다른 시간을 제안했습니다."
                description="선택하면 통화를 이어갑니다."
                options={[
                  { id: "accept", label: "제안 시간으로 예약" },
                  { id: "stop", label: "예약하지 않기" },
                ]}
                selectedId="accept"
                onChange={() => undefined}
              />
            </Surface>
          </section>
        </div>
      </main>
    </div>
  );
}
