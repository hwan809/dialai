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
    {
      capabilities: { tools: {} },
      instructions: "업장명이 주어지고 전화번호가 없으면 먼저 web search로 공개 전화번호를 확인하세요. 예약에 필요한 인원·이름 등 필수 정보가 없으면 사용자에게 질문하세요. 확인된 전화번호로 create_phone_call을 정확히 한 번 호출하고, 반환된 callId는 get_phone_call로 조회하세요. DialAI 도구가 없거나 오류가 나면 shell 또는 직접 통신사 API로 우회하지 말고 사용자에게 연결 오류를 알리세요.",
    },
  );

  server.registerTool("create_phone_call", { description: "After using web search to verify the public destination number and collecting required user details, queue the phone call exactly once. The call runs asynchronously; never bypass this tool with shell scripts or direct telephony APIs.", inputSchema: createPhoneCallInputSchema }, async (input) => {
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
