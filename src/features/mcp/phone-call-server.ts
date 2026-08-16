import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import { createPhoneCallInputSchema, listPhoneCallsSchema, phoneCallIdSchema } from "@/features/phone-calls/schema";
import { PhoneCallService } from "@/features/phone-calls/service";
import type { PhoneCallJob } from "@/features/phone-calls/types";

export type PhoneCallMcpDependencies = { tenantId: string; service: PhoneCallService };

function success(content: string, structuredContent: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: content }], structuredContent };
}

function toolError(message: string) { return { content: [{ type: "text" as const, text: message }], isError: true }; }

function callContent(call: PhoneCallJob): Record<string, unknown> {
  return { id: call.id, status: call.status, createdAt: call.createdAt, updatedAt: call.updatedAt, destinationPhone: call.destinationPhone, objective: call.objective, context: call.context, successCriteria: call.successCriteria, outcome: call.outcome, lastFailureReason: call.lastFailureReason };
}

export function buildPhoneCallMcpServer(deps: PhoneCallMcpDependencies): McpServer {
  const server = new McpServer(
    { name: "dialai-phone-caller", version: "0.1.0" },
    { capabilities: { tools: {} }, instructions: "create_phone_call은 비동기입니다. callId를 보관하고 get_phone_call로 결과를 확인하세요." },
  );

  server.registerTool("create_phone_call", { description: "Queue a phone call that runs asynchronously.", inputSchema: createPhoneCallInputSchema }, async (input) => {
    try {
      const call = await deps.service.create(deps.tenantId, input);
      return success(`전화 작업 ${call.id}이(가) ${call.status} 상태로 생성되었습니다.`, { callId: call.id, status: call.status, createdAt: call.createdAt });
    } catch { return toolError("전화 작업 입력이 올바르지 않습니다."); }
  });

  server.registerTool("get_phone_call", { description: "Get a queued or completed phone call.", inputSchema: phoneCallIdSchema }, async ({ callId }) => {
    try {
      const call = await deps.service.get(deps.tenantId, callId);
      return call ? success(`전화 작업 ${call.id}의 현재 상태는 ${call.status}입니다.`, callContent(call)) : toolError("전화 작업을 찾을 수 없습니다.");
    } catch { return toolError("전화 작업을 조회할 수 없습니다."); }
  });

  server.registerTool("list_phone_calls", { description: "List recent phone calls for the authenticated tenant.", inputSchema: listPhoneCallsSchema }, async ({ limit }) => {
    try {
      const calls = await deps.service.list(deps.tenantId, limit);
      return success(`${calls.length}개의 전화 작업을 반환했습니다.`, { calls: calls.map(callContent) });
    } catch { return toolError("전화 작업 목록을 조회할 수 없습니다."); }
  });

  server.registerTool("cancel_phone_call", { description: "Cancel a queued or retry-scheduled phone call.", inputSchema: phoneCallIdSchema }, async ({ callId }) => {
    try {
      const result = await deps.service.cancel(deps.tenantId, callId);
      if (!result.job) return toolError("전화 작업을 찾을 수 없습니다.");
      return success(result.canceled ? `전화 작업 ${callId}을(를) 취소했습니다.` : `전화 작업 ${callId}은(는) 취소할 수 없습니다.`, { canceled: result.canceled, cancelable: result.cancelable, job: callContent(result.job) });
    } catch { return toolError("전화 작업을 취소할 수 없습니다."); }
  });

  return server;
}

export function createPhoneCallMcpHandler(deps: PhoneCallMcpDependencies) {
  return createMcpHandler(() => buildPhoneCallMcpServer(deps));
}
