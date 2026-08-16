import { describe, expect, it } from "vitest";

import { readWebTenantId } from "./server-runtime";

describe("readWebTenantId", () => {
  it("서버 전용 웹 테넌트 UUID를 반환한다", () => {
    expect(readWebTenantId({
      DIALAI_WEB_TENANT_ID: "debc18be-3552-4b1d-a852-a96121f7f7b0",
    })).toBe("debc18be-3552-4b1d-a852-a96121f7f7b0");
  });

  it.each([undefined, "not-a-uuid"])("웹 테넌트가 %s이면 시작을 거부한다", (tenantId) => {
    expect(() => readWebTenantId({ DIALAI_WEB_TENANT_ID: tenantId })).toThrow(
      "DIALAI_WEB_TENANT_ID",
    );
  });
});
