import { useCallback, useEffect, useState } from "react";

import { trackAnalyticsEvent } from "../analytics";

export type UseAdminPageOptions<T> = {
  load: () => Promise<T>;
  save?: (value: T) => Promise<T | void>;
  reset?: () => Promise<T | void>;
  initialData?: T;
  loadErrorMessage?: string;
  saveErrorMessage?: string;
  resetErrorMessage?: string;
  saveSuccessMessage?: string;
  resetSuccessMessage?: string;
  trackOpenEvent?: string;
  trackOpenPayload?: Record<string, unknown>;
};

export function useAdminPage<T>({
  load,
  save,
  reset,
  initialData,
  loadErrorMessage = "Failed to load",
  saveErrorMessage = "Failed to save",
  resetErrorMessage = "Failed to reset",
  saveSuccessMessage,
  resetSuccessMessage,
  trackOpenEvent,
  trackOpenPayload,
}: UseAdminPageOptions<T>) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!trackOpenEvent) {
      return;
    }
    trackAnalyticsEvent(trackOpenEvent, trackOpenPayload ?? {});
  }, [trackOpenEvent, trackOpenPayload]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await load();
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : loadErrorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [load, loadErrorMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = useCallback(async () => {
    if (!save || data === undefined) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await save(data);
      if (result !== undefined) {
        setData(result);
      }
      if (saveSuccessMessage) {
        setSuccess(saveSuccessMessage);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : saveErrorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [save, data, saveErrorMessage, saveSuccessMessage]);

  const handleReset = useCallback(async () => {
    if (!reset) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await reset();
      if (result !== undefined) {
        setData(result);
      }
      if (resetSuccessMessage) {
        setSuccess(resetSuccessMessage);
      }
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : resetErrorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [reset, resetErrorMessage, resetSuccessMessage]);

  return {
    data,
    setData,
    isLoading,
    isSaving,
    error,
    success,
    setError,
    setSuccess,
    reload,
    save: handleSave,
    reset: reset ? handleReset : undefined,
  };
}
