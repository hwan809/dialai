"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { Surface } from "@/components/ui/Surface";
import { createReservationGateway } from "./gateway";
import { ReservationConversation } from "./ReservationConversation";
import { ReservationProgress } from "./ReservationProgress";
import { ReservationResult } from "./ReservationResult";
import type { CreateReservationInput, ReservationJob, UserCallResponse } from "./types";
import { isTerminalReservationStatus } from "./types";

type FlowState =
  | { readonly kind: "chat" }
  | { readonly job: ReservationJob; readonly kind: "tracking" };

const demoMode = process.env.NEXT_PUBLIC_RESERVATION_DEMO_MODE !== "false";

export function ReservationApp() {
  const gateway = useMemo(() => createReservationGateway(), []);
  const [flow, setFlow] = useState<FlowState>({ kind: "chat" });
  const [chatSession, setChatSession] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (flow.kind !== "tracking" || isTerminalReservationStatus(flow.job.status)) {
      return;
    }
    const interval = window.setInterval(() => {
      void gateway
        .get(flow.job.id)
        .then((job) => setFlow({ job, kind: "tracking" }))
        .catch((caught) => {
          if (caught instanceof Error) {
            setError(caught.message);
            return;
          }
          throw caught;
        });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [flow, gateway]);

  const startCall = async (input: CreateReservationInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const job = await gateway.create(input);
      setFlow({ job, kind: "tracking" });
    } catch (caught) {
      if (caught instanceof Error) {
        setError(caught.message);
        return;
      }
      throw caught;
    } finally {
      setSubmitting(false);
    }
  };

  const cancelCall = async (job: ReservationJob) => {
    try {
      const canceled = await gateway.cancel(job.id);
      setFlow({ job: canceled, kind: "tracking" });
    } catch (caught) {
      if (caught instanceof Error) {
        setError(caught.message);
        return;
      }
      throw caught;
    }
  };

  const respondToCall = async (job: ReservationJob, response: UserCallResponse) => {
    try {
      const updated = await gateway.respond(job.id, response);
      setFlow({ job: updated, kind: "tracking" });
    } catch (caught) {
      if (caught instanceof Error) {
        setError(caught.message);
        return;
      }
      throw caught;
    }
  };

  const activeCall = flow.kind === "tracking" && !isTerminalReservationStatus(flow.job.status);
  const resetFlow = () => {
    setError(null);
    setFlow({ kind: "chat" });
    setChatSession((current) => current + 1);
    setMobileNavOpen(false);
  };

  return (
    <div className="product-shell">
      <AppSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onNewCall={resetFlow} />
      {mobileNavOpen && <button type="button" className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} aria-label="메뉴 닫기" />}
      <div className="app-shell">
        <AppHeader demoMode={demoMode} onMenuClick={() => setMobileNavOpen(true)} />
        {activeCall ? (
          <ReservationProgress
            demoMode={demoMode}
            job={flow.job}
            onCancel={() => void cancelCall(flow.job)}
            onRespond={(response) => void respondToCall(flow.job, response)}
          />
        ) : (
          <main id="main-content" className="page-frame page-frame--compact">
            {flow.kind === "chat" && (
              <ReservationConversation
                key={chatSession}
                submitting={submitting}
                onStart={(input) => void startCall(input)}
              />
            )}
            {flow.kind === "tracking" && (
              <ReservationResult
                job={flow.job}
                onReset={resetFlow}
              />
            )}
            {error !== null && (
              <Surface tone="error" className="global-alert">
                <p role="alert">{error}</p>
              </Surface>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
