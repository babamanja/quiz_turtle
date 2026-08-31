import { PART_OF_SPEECH_VALUES } from "@language-turtle/shared";
import { useTranslation } from "react-i18next";

type PartOfSpeechSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export default function PartOfSpeechSelect({
  id,
  value,
  onChange,
  disabled = false,
  className = "text-input",
  "aria-label": ariaLabel,
}: PartOfSpeechSelectProps) {
  const { t } = useTranslation();

  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("wordDetailPage.partOfSpeechUnset")}</option>
      {PART_OF_SPEECH_VALUES.map((pos) => (
        <option key={pos} value={pos}>
          {t(`partOfSpeech.${pos}`)}
        </option>
      ))}
    </select>
  );
}
