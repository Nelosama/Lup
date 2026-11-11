import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Send, ArrowLeft } from "lucide-react";
import { useAuth } from "../app/auth";
import { api, type Paginated } from "../services/api";
import {
  Action,
  Empty,
  ErrorBox,
  Loader,
  PageTitle,
  Pagination,
  ReportButton,
} from "../components/ui";
export function Messages() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [listPage, setListPage] = useState(1);
  const [body, setBody] = useState("");
  const conversations = useQuery({
    queryKey: ["conversations", listPage],
    queryFn: () => api<Paginated>(`/conversations?page=${listPage}`),
    refetchInterval: 15000,
  });
  const messages = useQuery({
    queryKey: ["messages", id, page],
    queryFn: () =>
      api<Paginated>(`/conversations/${id}/messages?page=${page}&limit=30`),
    enabled: !!id,
    refetchInterval: 10000,
  });
  const send = useMutation({
    mutationFn: () => api(`/conversations/${id}/messages`, "POST", { body }),
    onSuccess: () => {
      setBody("");
      setPage(1);
      void cache.invalidateQueries();
    },
  });
  const conversation = conversations.data?.items.find((c) => c.id === id);
  const other = conversation?.participants.find(
    (p: any) => p.userId !== user?.id,
  );
  useEffect(() => {
    setPage(1);
    setBody("");
  }, [id]);
  useEffect(() => {
    if (id && messages.data)
      void api(`/conversations/${id}/read`, "POST").catch(() => {});
  }, [id, messages.dataUpdatedAt]);
  return (
    <>
      <PageTitle title={t("messages")} />
      <div className={`messenger ${id ? "has-conversation" : ""}`}>
        <aside className="conversation-list">
          <ErrorBox error={conversations.error} />
          {conversations.isPending ? (
            <Loader />
          ) : conversations.data?.items.length ? (
            conversations.data.items.map((c) => {
              const p = c.participants.find((p: any) => p.userId !== user?.id);
              return (
                <Link
                  className={`conversation-item ${id === c.id ? "selected" : ""}`}
                  key={c.id}
                  to={`/app/messages/${c.id}`}
                >
                  <div className="avatar">{p?.user.name[0]}</div>
                  <div>
                    <strong>{p?.user.name}</strong>
                    <p>
                      {c.messages[0]?.body ??
                        c.engagement?.title ??
                        t("conversation")}
                    </p>
                  </div>
                  {c.unread > 0 && <span className="badge">{c.unread}</span>}
                </Link>
              );
            })
          ) : (
            <Empty text={t("noConversations")} />
          )}
          {conversations.data && (
            <Pagination data={conversations.data} onChange={setListPage} />
          )}
        </aside>
        <section className="message-thread">
          {id ? (
            <>
              <div className="thread-header">
                <Link
                  className="mobile-back"
                  to="/app/messages"
                  aria-label={t("back")}
                >
                  <ArrowLeft size={20} />
                </Link>
                <strong>{other?.user.name ?? t("conversation")}</strong>
                <div className="actions">
                  <ReportButton targetType="CONVERSATION" targetId={id} />
                  {other && (
                    <Action
                      path={`/blocks/${other.userId}`}
                      className="text-button"
                    >
                      {t("block")}
                    </Action>
                  )}
                </div>
              </div>
              <div className="message-history" aria-live="polite">
                <ErrorBox error={messages.error} />
                {messages.isPending ? (
                  <Loader />
                ) : messages.data?.items.length ? (
                  [...messages.data.items].reverse().map((m) => (
                    <div
                      key={m.id}
                      className={`message ${m.senderId === user?.id ? "mine" : ""}`}
                    >
                      <p>{m.body}</p>
                      <div>
                        <time>
                          {new Intl.DateTimeFormat(i18n.language, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(m.createdAt))}
                        </time>
                        <ReportButton targetType="MESSAGE" targetId={m.id} />
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text={t("noMessages")} />
                )}
                {messages.data && (
                  <Pagination data={messages.data} onChange={setPage} />
                )}
              </div>
              <ErrorBox error={send.error} />
              <form
                className="message-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (body.trim()) send.mutate();
                }}
              >
                <label className="sr-only" htmlFor="message-body">
                  {t("writeMessage")}
                </label>
                <textarea
                  id="message-body"
                  placeholder={t("writeMessage")}
                  maxLength={4000}
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <button
                  className="button"
                  disabled={!body.trim() || send.isPending}
                  aria-label={t("send")}
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          ) : (
            <Empty text={t("noConversations")} />
          )}
        </section>
      </div>
    </>
  );
}
