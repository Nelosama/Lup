import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  ArrowRight,
  Inbox,
  AlertCircle,
  Flag,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, type Paginated } from "../services/api";
export function Loader() {
  const { t } = useTranslation();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {t("loading")}
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="alert error" role="alert">
      <AlertCircle size={18} />
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="alert" role="status">
      {children}
    </div>
  );
}
export function Empty({
  text,
  action,
  to,
}: {
  text?: string;
  action?: string;
  to?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{t("empty")}</h3>
      <p>{text}</p>
      {to && (
        <Link className="button secondary" to={to}>
          {action}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const { t } = useTranslation();
  return <span className={`badge status-${value}`}>{t(value)}</span>;
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  data,
  onChange,
}: {
  data: Paginated;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  return data.total > data.limit ? (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="button secondary"
        disabled={data.page === 1}
        onClick={() => onChange(data.page - 1)}
      >
        {t("previous")}
      </button>
      <span>
        {data.page} / {Math.ceil(data.total / data.limit)}
      </span>
      <button
        className="button secondary"
        disabled={data.page * data.limit >= data.total}
        onClick={() => onChange(data.page + 1)}
      >
        {t("next")}
      </button>
    </nav>
  ) : null;
}
export function Action({
  path,
  body,
  children,
  onSuccess,
  className = "button secondary",
}: {
  path: string;
  body?: unknown;
  children: ReactNode;
  onSuccess?: (r: any) => void;
  className?: string;
}) {
  const q = useQueryClient();
  const m = useMutation({
    mutationFn: () => api(path, "POST", body),
    onSuccess: (r) => {
      void q.invalidateQueries();
      onSuccess?.(r);
    },
  });
  return (
    <>
      <button
        className={className}
        disabled={m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? <LoaderCircle size={16} className="spin" /> : null}
        {children}
      </button>
      <ErrorBox error={m.error} />
    </>
  );
}
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => api("/reports", "POST", { targetType, targetId, reason }),
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        <Flag size={14} />
        {t("report")}
      </button>
      {m.isSuccess && <Notice>{t("reportDone")}</Notice>}
      {open && (
        <Modal label={t("report")} onClose={() => setOpen(false)}>
          <h2>{t("report")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <label>
              {t("reportReason")}
              <textarea
                required
                minLength={10}
                maxLength={2000}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <ErrorBox error={m.error} />
            <div className="actions">
              <button className="button" disabled={m.isPending}>
                {t("send")}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Avatar({
  userId,
  name,
  path,
  size = "",
}: {
  userId: string;
  name: string;
  path?: string;
  size?: string;
}) {
  const q = useQuery({
    queryKey: ["avatar", userId, path],
    queryFn: () => api(`/avatars/${userId}`),
    enabled: !!path,
    staleTime: 480000,
  });
  return (
    <div className={`avatar ${size}`}>
      {q.data ? (
        <img src={q.data.url} alt={name} loading="lazy" />
      ) : (
        name.slice(0, 1)
      )}
    </div>
  );
}

export function Modal({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal native-modal"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
