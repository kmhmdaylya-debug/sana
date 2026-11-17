import { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Modal, useToast } from './ui';

/** لیست رمزهای ضعیف (باید با بک‌اند هم‌خوانی داشته باشد) */
const WEAK_PASSWORDS = new Set([
  '1234567890', 'password', 'password123', 'qwerty123', 'admin123', 'welcome123',
  'sana123', 'iran123', '14001400', '14011401', '14021402', '14031403',
]);

/** بررسی قدرت رمز عبور — باید با بک‌اند (password.util.ts) هم‌خوانی داشته باشد */
function validatePasswordStrength(password: string): { valid: boolean; errors: string[]; strength: number } {
  const errors: string[] = [];
  let strength = 0;

  if (password.length < 10) errors.push('حداقل ۱۰ کاراکتر');
  else strength += 1;

  if (!/[A-Z]/.test(password)) errors.push('حداقل یک حرف بزرگ');
  else strength += 1;

  if (!/[a-z]/.test(password)) errors.push('حداقل یک حرف کوچک');
  else strength += 1;

  if (!/[0-9]/.test(password)) errors.push('حداقل یک عدد');
  else strength += 1;

  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) errors.push('حداقل یک نماد (!@#$%^&*...)');
  else strength += 1;

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push('رمز عبور بسیار رایج است');
    strength = 0;
  }

  return { valid: errors.length === 0, errors, strength };
}

export default function ChangePassword() {
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [strength, setStrength] = useState<{ valid: boolean; errors: string[]; strength: number }>({ valid: false, errors: [], strength: 0 });
  const clear = () => { setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setStrength({ valid: false, errors: [], strength: 0 }); };
  const close = () => { if (saving) return; setOpen(false); clear(); };

  const handleNewPasswordChange = (value: string) => {
    setForm((f) => ({ ...f, newPassword: value }));
    const result = validatePasswordStrength(value);
    setStrength(result);
  };

  const submit = async () => {
    if (saving) return;
    if (form.newPassword !== form.confirmPassword) {
      toast('error', 'تکرار گذرواژه با گذرواژهٔ جدید یکسان نیست.');
      return;
    }
    const validation = validatePasswordStrength(form.newPassword);
    if (!validation.valid) {
      toast('error', 'رمز عبور ضعیف است: ' + validation.errors.join('، '));
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

  const getStrengthColor = (strength: number) => {
    if (strength <= 1) return 'bg-red-500';
    if (strength <= 3) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <>
      <button className="header-icon-btn" title="تغییر گذرواژهٔ من" aria-label="تغییر گذرواژهٔ من" onClick={() => { clear(); setOpen(true); }}><KeyRound size={18} /></button>
      <Modal open={open} title="تغییر گذرواژهٔ من" onClose={close} footer={<>
        <Button loading={saving} disabled={!form.currentPassword || !form.newPassword || !form.confirmPassword || !strength.valid} onClick={submit}>ثبت گذرواژه</Button>
        <Button variant="secondary" disabled={saving} onClick={close}>انصراف</Button>
      </>}>
        <div className="col" style={{ gap: 14 }}>
          <Field label="گذرواژهٔ فعلی" required>
            <Input type="password" className="ltr" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} />
          </Field>
          <Field label="گذرواژهٔ جدید" required hint="حداقل ۱۰ کاراکتر شامل حرف بزرگ، حرف کوچک، عدد و نماد">
            <Input type="password" className="ltr" autoComplete="new-password" maxLength={128} value={form.newPassword} onChange={(e) => handleNewPasswordChange(e.target.value)} />
            {form.newPassword && (
              <div className="col" style={{ gap: 6, marginTop: 4 }}>
                <div className="strength-bar" style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--border)' }}>
                  <div className={getStrengthColor(strength.strength)} style={{ height: '100%', width: `${(strength.strength / 5) * 100}%`, transition: 'width 0.2s ease' }} />
                </div>
                {strength.errors.length > 0 && (
                  <div className="col" style={{ gap: 4 }}>
                    {strength.errors.map((err, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-red-500 text-xs">
                        <AlertCircle size={12} />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
                {strength.valid && (
                  <div className="flex items-center gap-1.5 text-green-500 text-xs">
                    <CheckCircle size={12} />
                    <span>رمز عبور قوی است</span>
                  </div>
                )}
              </div>
            )}
          </Field>
          <Field label="تکرار گذرواژهٔ جدید" required>
            <Input type="password" className="ltr" autoComplete="new-password" maxLength={128} value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
