import { type FormEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type AdminTag,
  createAdminTag,
  deleteAdminTag,
  getAdminTags,
  updateAdminTag,
} from "../../api/admin";
import Button from "../../components/UI/Button/Button";
import Modal from "../../components/UI/Modal";
import Page from "../../components/UI/Page";
import PageHeader from "../../components/UI/PageHeader";
import TextInput from "../../components/UI/TextInput";
import { useAdminPage } from "../../hooks/useAdminPage";
import TagHierarchyList from "./TagHierarchyList";
import { buildTagTree, getDescendantTagIds } from "./tagTree";

import "../style.scss";

type TagFormMode = "create" | "edit";

function mapTagError(code: string, t: (key: string) => string): string {
  switch (code) {
    case "tag name is required":
      return t("admin.tagsNameRequired");
    case "tag name already exists":
      return t("admin.tagsNameExists");
    case "parent tag not found":
      return t("admin.tagsParentNotFound");
    case "tag cannot be its own parent":
      return t("admin.tagsSelfParent");
    case "cyclic tag hierarchy":
      return t("admin.tagsCycle");
    case "tag not found":
      return t("admin.tagsNotFound");
    default:
      return t("admin.tagsSaveFailed");
  }
}

export default function AdminTagsPage() {
  const { t } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<TagFormMode>("create");
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<number | null>(null);
  const [createUnderParent, setCreateUnderParent] = useState<AdminTag | null>(null);

  const loadTags = useCallback(() => getAdminTags().then((items) => ({ items })), []);

  const {
    data,
    error,
    isLoading,
    reload,
  } = useAdminPage({
    load: loadTags,
    loadErrorMessage: t("admin.tagsLoadFailed"),
  });

  const tags = data?.items ?? [];
  const tagTree = useMemo(() => buildTagTree(tags), [tags]);

  const parentOptions = useMemo(() => {
    if (formMode === "edit" && editingTag) {
      const excluded = new Set(getDescendantTagIds(editingTag.id, tags));
      excluded.add(editingTag.id);
      return tags.filter((tag) => !excluded.has(tag.id));
    }
    return tags;
  }, [editingTag, formMode, tags]);

  function openCreateForm() {
    setFormMode("create");
    setEditingTag(null);
    setCreateUnderParent(null);
    setName("");
    setParentId(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openCreateChildForm(parentTag: AdminTag) {
    setFormMode("create");
    setEditingTag(null);
    setCreateUnderParent(parentTag);
    setName("");
    setParentId(parentTag.id);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditForm(tag: AdminTag) {
    setFormMode("edit");
    setEditingTag(tag);
    setName(tag.name);
    setParentId(tag.parentId);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingTag(null);
    setCreateUnderParent(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t("admin.tagsNameRequired"));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await createAdminTag({ name: trimmedName, parentId });
      } else if (editingTag) {
        await updateAdminTag(editingTag.id, { name: trimmedName, parentId });
      }
      closeForm();
      await reload();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t("admin.tagsSaveFailed");
      setFormError(mapTagError(message, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(tag: AdminTag) {
    const confirmed = window.confirm(
      t("admin.tagsDeleteConfirm", { name: tag.name, count: tag.childCount }),
    );
    if (!confirmed) {
      return;
    }

    setDeletingTagId(tag.id);
    try {
      await deleteAdminTag(tag.id);
      await reload();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : t("admin.tagsDeleteFailed");
      window.alert(mapTagError(message, t));
    } finally {
      setDeletingTagId(null);
    }
  }

  return (
    <Page width="full">
      <PageHeader
        title={t("admin.tagsTitle")}
        subtitle={t("admin.tagsDescription")}
        actions={
          <Button type="button" onClick={openCreateForm}>
            {t("admin.tagsAdd")}
          </Button>
        }
      />
      {error ? <p className="upload-file__error">{error}</p> : null}
      {isLoading ? <p>{t("admin.tagsLoading")}</p> : null}
      {!isLoading && tagTree.length > 0 ? (
        <TagHierarchyList
          nodes={tagTree}
          deletingTagId={deletingTagId}
          onAddChild={openCreateChildForm}
          onEdit={openEditForm}
          onDelete={handleDelete}
          t={t}
        />
      ) : null}
      {!isLoading && tagTree.length === 0 ? <p>{t("admin.tagsEmpty")}</p> : null}

      <Modal
        open={formOpen}
        buttons={
          <>
            <Button style="secondary" onClick={closeForm} disabled={isSubmitting}>
              {t("admin.tagsCancel")}
            </Button>
            <Button type="submit" form="admin-tag-form" disabled={isSubmitting}>
              {isSubmitting
                ? t("admin.tagsSaving")
                : formMode === "create"
                  ? t("admin.tagsCreate")
                  : t("admin.tagsSave")}
            </Button>
          </>
        }
      >
        <form id="admin-tag-form" className="add-word-modal" onSubmit={handleSubmit}>
          <h2 className="add-word-modal__title">
            {formMode === "create"
              ? createUnderParent
                ? t("admin.tagsAddChildTitle", { name: createUnderParent.name })
                : t("admin.tagsAddTitle")
              : t("admin.tagsEditTitle")}
          </h2>
          {formError ? <p className="upload-file__error">{formError}</p> : null}
          <label className="add-word-modal__hint" htmlFor="admin-tag-name">
            {t("admin.tagsName")}
          </label>
          <TextInput
            id="admin-tag-name"
            value={name}
            onChange={setName}
            disabled={isSubmitting}
            required
          />
          <label className="add-word-modal__hint" htmlFor="admin-tag-parent">
            {t("admin.tagsParent")}
          </label>
          <select
            id="admin-tag-parent"
            className="text-input"
            style={{ marginBottom: 0 }}
            value={parentId ?? ""}
            disabled={isSubmitting || createUnderParent != null}
            onChange={(event) => {
              const value = event.target.value;
              setParentId(value ? Number(value) : null);
            }}
          >
            <option value="">{t("admin.tagsNoParent")}</option>
            {parentOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </form>
      </Modal>
    </Page>
  );
}
