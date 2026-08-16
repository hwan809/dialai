"use client";

import { Check, Copy, SpinnerGap, TerminalWindow } from "@phosphor-icons/react";
import { useState } from "react";

import { ensureAccessToken, requestMcpInstall } from "@/features/onboarding/mcp-browser-client";
import { supabase } from "@/lib/supabase";

export function McpConnectCard() {
  const [command, setCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createCommand = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const token = await ensureAccessToken(supabase.auth);
      const result = await requestMcpInstall(token);
      setCommand(result.installCommand);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결 명령을 만들지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const copyCommand = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setError("복사하지 못했습니다. 명령을 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <div className="mcp-connect-card">
      <div className="mcp-connect-card__title">
        <span aria-hidden><TerminalWindow size={22} weight="bold" /></span>
        <div>
          <strong>DialAI MCP</strong>
          <small>Codex CLI · macOS / Linux</small>
        </div>
      </div>

      {command ? (
        <>
          <p className="mcp-connect-card__ready"><Check size={17} weight="bold" /> 연결 명령이 준비됐어요</p>
          <div className="mcp-command">
            <code>{command}</code>
            <button type="button" onClick={() => void copyCommand()} aria-label="Codex 연결 명령 복사">
              {copied ? <Check size={19} weight="bold" /> : <Copy size={19} />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <p className="mcp-connect-card__hint">터미널에 붙여넣으면 연결 확인 후 새 Codex 세션이 열립니다.</p>
        </>
      ) : (
        <>
          <p className="mcp-connect-card__description">별도 서버나 worker 설치 없이, 이 기기의 Codex에 DialAI 전화 도구를 등록합니다.</p>
          <button className="mcp-connect-card__generate" type="button" onClick={() => void createCommand()} disabled={loading}>
            {loading && <SpinnerGap className="mcp-connect-card__spinner" size={19} />}
            {loading ? "안전한 연결 명령 만드는 중" : "한 줄 연결 명령 만들기"}
          </button>
        </>
      )}

      {error && <p className="mcp-connect-card__error" role="alert">{error}</p>}
    </div>
  );
}
