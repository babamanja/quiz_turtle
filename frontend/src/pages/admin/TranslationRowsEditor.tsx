import { useTranslation } from "react-i18next";

import type { AdminTag, AdminTranslationRowInput } from "../../api/admin";
import PartOfSpeechSelect from "../../components/PartOfSpeechSelect";
import Button from "../../components/UI/Button/Button";
import TagTreePicker from "./TagTreePicker";
import { toggleTagSelection, type TagTreeNode } from "./tagTree";

export type TranslationDraftRow = {
  id: string;
  primaryText: string;
  learningText: string;
  partOfSpeech: string;
  tagIds: number[];
};

type TranslationRowsEditorProps = {
  rows: TranslationDraftRow[];
  tags: AdminTag[];
  tagTree: TagTreeNode[];
  primaryLanguageName: string;
  learningLanguageName: string;
  disabled?: boolean;
  onChange: (rows: TranslationDraftRow[]) => void;
};

function createEmptyRow(): TranslationDraftRow {
  return {
    id: crypto.randomUUID(),
    primaryText: "",
    learningText: "",
    partOfSpeech: "",
    tagIds: [],
  };
}

export function createTranslationDraftRows(count = 3): TranslationDraftRow[] {
  return Array.from({ length: count }, () => createEmptyRow());
}

export function toTranslationRowInputs(rows: TranslationDraftRow[]): AdminTranslationRowInput[] {
  return rows
    .map((row) => ({
      primaryText: row.primaryText.trim(),
      learningText: row.learningText.trim(),
      partOfSpeech: row.partOfSpeech || null,
      tagIds: row.tagIds,
    }))
    .filter((row) => row.primaryText || row.learningText);
}

export default function TranslationRowsEditor({
  rows,
  tags,
  tagTree,
  primaryLanguageName,
  learningLanguageName,
  disabled = false,
  onChange,
}: TranslationRowsEditorProps) {
  const { t } = useTranslation();

  function updateRow(rowId: string, patch: Partial<TranslationDraftRow>) {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function removeRow(rowId: string) {
    if (rows.length <= 1) {
      onChange([createEmptyRow()]);
      return;
    }
    onChange(rows.filter((row) => row.id !== rowId));
  }

  function addRow() {
    onChange([...rows, createEmptyRow()]);
  }

  function toggleRowTag(rowId: string, tagId: number) {
    onChange(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, tagIds: toggleTagSelection(tagId, row.tagIds, tags) }
          : row,
      ),
    );
  }

  return (
    <div className="translation-rows-editor">
      <div className="translation-rows-editor__table-wrap">
        <table className="translation-rows-editor__table">
          <thead>
            <tr>
              <th>{primaryLanguageName || t("admin.translationsWordLanguage1")}</th>
              <th>{learningLanguageName || t("admin.translationsWordLanguage2")}</th>
              <th>{t("wordDetailPage.partOfSpeech")}</th>
              <th>{t("admin.translationsTags")}</th>
              <th className="translation-rows-editor__actions-head">
                <span className="visually-hidden">{t("admin.translationsActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="text-input translation-rows-editor__input"
                    value={row.primaryText}
                    onChange={(event) => updateRow(row.id, { primaryText: event.target.value })}
                    disabled={disabled}
                    placeholder={t("admin.translationsRowLanguage1Placeholder", {
                      n: index + 1,
                      language: primaryLanguageName,
                    })}
                    aria-label={t("admin.translationsRowLanguage1Aria", {
                      n: index + 1,
                      language: primaryLanguageName,
                    })}
                  />
                </td>
                <td>
                  <input
                    className="text-input translation-rows-editor__input"
                    value={row.learningText}
                    onChange={(event) => updateRow(row.id, { learningText: event.target.value })}
                    disabled={disabled}
                    placeholder={t("admin.translationsRowLanguage2Placeholder", {
                      n: index + 1,
                      language: learningLanguageName,
                    })}
                    aria-label={t("admin.translationsRowLanguage2Aria", {
                      n: index + 1,
                      language: learningLanguageName,
                    })}
                  />
                </td>
                <td>
                  <PartOfSpeechSelect
                    className="text-input translation-rows-editor__pos"
                    value={row.partOfSpeech}
                    disabled={disabled}
                    onChange={(partOfSpeech) => updateRow(row.id, { partOfSpeech })}
                    aria-label={t("admin.translationsRowPartOfSpeechAria", { n: index + 1 })}
                  />
                </td>
                <td>
                  {tagTree.length === 0 ? (
                    <span className="translation-rows-editor__tags-empty">
                      {t("admin.translationsTagsEmpty")}
                    </span>
                  ) : (
                    <div
                      className="translation-rows-editor__tag-list"
                      aria-label={t("admin.translationsRowTagsAria", { n: index + 1 })}
                    >
                      <TagTreePicker
                        nodes={tagTree}
                        selectedTagIds={row.tagIds}
                        disabled={disabled}
                        onToggle={(tagId) => toggleRowTag(row.id, tagId)}
                      />
                    </div>
                  )}
                </td>
                <td className="translation-rows-editor__actions">
                  <Button
                    type="button"
                    style="secondary"
                    disabled={disabled}
                    onClick={() => removeRow(row.id)}
                  >
                    {t("admin.translationsRemoveRow")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="translation-rows-editor__footer">
        <Button type="button" style="secondary" disabled={disabled} onClick={addRow}>
          {t("admin.translationsAddRow")}
        </Button>
        <p className="add-word-modal__hint">{t("admin.translationsRowsHint")}</p>
      </div>
    </div>
  );
}
