import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Modal, useToast } from './ui';

export default function ChangePassword() {
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const clear = () => setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const close = () => {
    if (saving) return;
    setOpen(false);
    clear();
  };
  const submit = async () => {
    if (saving) return;
    if (form.newPassword !== form.confirmPassword) {
      toast('error', 'تکرار گذرواژه با گذرواژهٔ جدید یکسان نیست.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setOpen(false);
      clear();
      toast('success', 'گذرواژه تغییر کرد؛ با گذرواژهٔ جدید وارد شوید.');
      await logout();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button className="header-icon-btn" title="تغییر گذرواژهٔ من" aria-label="تغییر گذرواژهٔ من" onClick={() => { clear(); setOpen(true); }}><KeyRound size={18} /></button>
      <Modal open={open} title="تغییر گذرواژهٔ من" onClose={close} footer={<>
        <Button loading={saving} disabled={!form.currentPassword || !form.newPassword || !form.confirmPassword} onClick={submit}>ثبت گذرواژه</Button>
        <Button variant="secondary" disabled={saving} onClick={close}>انصراف</Button>
      </>}>
        <div className="col" style={{ gap: 14 }}>
          <Field label="گذرواژهٔ فعلی" required>
            <Input type="password" className="ltr" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} />
          </Field>
          <Field label="گذرواژهٔ جدید" required hint="حداقل ۱۰ کاراکتر شامل حرف بزرگ، حرف کوچک، عدد و نماد">
            <Input type="password" className="ltr" autoComplete="new-password" maxLength={128} value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
          </Field>
          <Field label="تکرار گذرواژهٔ جدید" required>
            <Input type="password" className="ltr" autoComplete="new-password" maxLength={128} value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
