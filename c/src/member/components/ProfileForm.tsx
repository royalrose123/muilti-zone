// 個人資訊（PLAN §13.5）：檢視／編輯，react-hook-form + zodResolver(profileInputSchema)。
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { isApiError, useProfile, useUpdateProfile } from '../api';
import { LoginRequired } from '../LoginRequired';
import { profileInputSchema, type ProfileInput } from '../schemas';
import type { Profile, ValidationError } from '../types';
import { Field, formatDateTime, inputClass, LoadError, Loading, primaryButton, secondaryButton } from '../ui';

const FIELDS = ['name', 'email', 'phone', 'address', 'birthday', 'newsletter'] as const satisfies readonly (keyof ProfileInput)[];

const toInput = (p: Profile): ProfileInput => ({
  name: p.name,
  email: p.email,
  phone: p.phone,
  address: p.address,
  birthday: p.birthday ?? '',
  newsletter: p.newsletter,
});

const isValidationError = (body: unknown): body is ValidationError =>
  typeof body === 'object' && body !== null && (body as { error?: unknown }).error === 'validation';

export function ProfileForm() {
  const result = useProfile();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  if (isApiError(result.error, 401)) return <LoginRequired />;
  if (result.isPending) return <Loading rows={4} />;
  if (result.isError) return <LoadError onRetry={() => void result.refetch()} />;

  const p = result.data;
  if (editing) {
    return (
      <EditProfile
        profile={p}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-900 shadow-sm">
      <dl className="grid grid-cols-[6rem_1fr] gap-y-2">
        <dt className="text-slate-500">姓名</dt>
        <dd>{p.name}</dd>
        <dt className="text-slate-500">Email</dt>
        <dd>{p.email}</dd>
        <dt className="text-slate-500">手機</dt>
        <dd>{p.phone}</dd>
        <dt className="text-slate-500">地址</dt>
        <dd>{p.address || '—'}</dd>
        <dt className="text-slate-500">生日</dt>
        <dd>{p.birthday ?? '—'}</dd>
        <dt className="text-slate-500">電子報</dt>
        <dd>{p.newsletter ? '訂閱' : '不訂閱'}</dd>
      </dl>
      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => setEditing(true)} className={primaryButton}>
          編輯
        </button>
        <span className="text-xs text-slate-500">最後更新 {formatDateTime(p.updatedAt)}</span>
        {saved && (
          <span role="status" className="ml-auto text-xs font-medium text-emerald-700">
            已儲存
          </span>
        )}
      </div>
    </div>
  );
}

function EditProfile({ profile, onCancel, onSaved }: { profile: Profile; onCancel(): void; onSaved(): void }) {
  const mutation = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    mode: 'onBlur',
    defaultValues: toInput(profile),
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || mutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
      onSaved();
    } catch (err) {
      if (isApiError(err, 400) && isValidationError(err.body)) {
        // 後端的驗證錯誤（例如 email 重複）顯示在對應欄位下方
        for (const field of FIELDS) {
          const message = err.body.fieldErrors[field]?.[0];
          if (message) form.setError(field, { type: 'server', message }, { shouldFocus: true });
        }
      } else if (isApiError(err, 401)) {
        setFormError('登入已失效，請重新登入');
      } else {
        setFormError('儲存失敗，請稍後再試');
      }
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-900 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="姓名" error={errors.name?.message}>
          <input {...form.register('name')} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" {...form.register('email')} autoComplete="email" className={inputClass} />
        </Field>
        <Field label="手機" error={errors.phone?.message}>
          <input type="tel" {...form.register('phone')} autoComplete="tel" placeholder="0912345678" className={inputClass} />
        </Field>
        <Field label="生日" error={errors.birthday?.message}>
          <input type="date" {...form.register('birthday')} className={inputClass} />
        </Field>
        <div className="md:col-span-2">
          <Field label="地址" error={errors.address?.message}>
            <textarea rows={2} {...form.register('address')} autoComplete="street-address" className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" {...form.register('newsletter')} className="size-4 accent-zone" />
          訂閱電子報
        </label>
      </div>
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? '儲存中…' : '儲存'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            form.reset(toInput(profile));
            onCancel();
          }}
          className={secondaryButton}
        >
          取消
        </button>
      </div>
    </form>
  );
}
