import { useId } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { ErrorBox, Notice } from "./ui";
export type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  min?: number;
  max?: number;
  help?: string;
};
export function SmartForm({
  fields,
  initial,
  submit,
  onSubmit,
  success,
}: {
  fields: Field[];
  initial?: Record<string, any>;
  submit: string;
  onSubmit: (data: Record<string, any>) => Promise<unknown>;
  success?: string;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const shape: Record<string, z.ZodType> = Object.fromEntries(
    fields.map((f) => {
      let s: z.ZodType;
      if (f.type === "checkbox") s = z.boolean();
      else if (f.type === "multi") s = z.array(z.string()).min(1);
      else if (f.type === "number")
        s = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
      else if (f.type === "email") s = z.email();
      else if (f.type === "password") s = z.string().min(12).max(128);
      else
        s = z
          .string()
          .min(f.min ?? 1)
          .max(f.max ?? 4000);
      if (f.optional) s = z.union([s, z.literal("")]).optional();
      return [f.name, s];
    }),
  );
  const schema = z.object(shape);
  const defaults = Object.fromEntries(
    fields.map((f) => [
      f.name,
      initial?.[f.name] ??
        (f.type === "checkbox" ? false : f.type === "multi" ? [] : ""),
    ]),
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, any>>({
    resolver: zodResolver(schema),
    defaultValues: defaults as DefaultValues<Record<string, any>>,
  });
  const m = useMutation({
    mutationFn: (d: Record<string, any>) =>
      onSubmit(
        Object.fromEntries(Object.entries(d).filter(([_, v]) => v !== "")),
      ),
  });
  return (
    <form
      className="form"
      onSubmit={handleSubmit((d) => m.mutate(d))}
      noValidate
    >
      {fields.map((f) => {
        const id = `${formId}-${f.name}`;
        const props = {
          ...register(f.name),
          id,
          "aria-invalid": !!errors[f.name],
          "aria-describedby": errors[f.name]
            ? `${id}-error`
            : f.help
              ? `${id}-help`
              : undefined,
        };
        return (
          <div
            key={f.name}
            className={`field ${f.type === "checkbox" ? "checkbox" : ""}`}
          >
            <label htmlFor={id}>{t(f.label)}</label>
            {f.type === "textarea" ? (
              <textarea {...props} rows={4} />
            ) : f.options ? (
              <select {...props} multiple={f.type === "multi"}>
                {f.type !== "multi" && <option value="">—</option>}
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...props}
                type={f.type === "number" ? "text" : (f.type ?? "text")}
                inputMode={f.type === "number" ? "decimal" : undefined}
                autoComplete={
                  f.type === "password"
                    ? "new-password"
                    : f.name === "email"
                      ? "email"
                      : f.name === "name"
                        ? "name"
                        : undefined
                }
              />
            )}
            {f.help && <small id={`${id}-help`}>{t(f.help)}</small>}
            {errors[f.name] && (
              <small id={`${id}-error`} className="field-error">
                {t("invalidForm")}
              </small>
            )}
          </div>
        );
      })}
      <ErrorBox error={m.error} />
      {m.isSuccess && success && <Notice>{t(success)}</Notice>}
      <button className="button" disabled={m.isPending}>
        {m.isPending ? t("loading") : t(submit)}
      </button>
    </form>
  );
}
