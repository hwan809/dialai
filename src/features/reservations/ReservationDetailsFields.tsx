import { Field } from "@/components/ui/Field";

export type ReservationDraft = {
  readonly customerName: string;
  readonly destinationPhone: string;
  readonly partySize: string;
  readonly placeName: string;
  readonly requestNotes: string;
  readonly requestedAt: string;
};

type ReservationDetailsFieldsProps = {
  readonly draft: ReservationDraft;
  readonly onChange: (draft: ReservationDraft) => void;
};

export function ReservationDetailsFields({ draft, onChange }: ReservationDetailsFieldsProps) {
  return (
    <div className="form-grid">
      <TextField
        id="place-name"
        label="전화할 매장"
        value={draft.placeName}
        placeholder="예: 한강식당"
        onChange={(placeName) => onChange({ ...draft, placeName })}
      />
      <TextField
        id="destination-phone"
        label="매장 전화번호"
        value={draft.destinationPhone}
        placeholder="02-1234-5678"
        inputMode="tel"
        onChange={(destinationPhone) => onChange({ ...draft, destinationPhone })}
      />
      <TextField
        id="customer-name"
        label="예약자명"
        value={draft.customerName}
        placeholder="예약에 사용할 이름"
        onChange={(customerName) => onChange({ ...draft, customerName })}
      />
      <Field htmlFor="party-size" label="예약 인원">
        <input
          id="party-size"
          className="field-control"
          type="number"
          min={1}
          max={20}
          value={draft.partySize}
          onChange={(event) => onChange({ ...draft, partySize: event.target.value })}
          required
        />
      </Field>
      <div className="form-grid__full">
        <Field htmlFor="requested-at" label="예약 일시">
          <input
            id="requested-at"
            className="field-control"
            type="datetime-local"
            value={draft.requestedAt}
            onChange={(event) => onChange({ ...draft, requestedAt: event.target.value })}
            required
          />
        </Field>
      </div>
      <div className="form-grid__full">
        <Field htmlFor="request-notes" label="추가 요청" help="좌석, 알레르기, 주차처럼 통화 중 전달할 내용을 적어주세요.">
          <textarea
            id="request-notes"
            className="field-control"
            value={draft.requestNotes}
            onChange={(event) => onChange({ ...draft, requestNotes: event.target.value })}
            rows={3}
          />
        </Field>
      </div>
    </div>
  );
}

type TextFieldProps = {
  readonly id: string;
  readonly inputMode?: "tel";
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly value: string;
};

function TextField({ id, inputMode, label, onChange, placeholder, value }: TextFieldProps) {
  return (
    <Field htmlFor={id} label={label}>
      <input
        id={id}
        className="field-control"
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </Field>
  );
}
