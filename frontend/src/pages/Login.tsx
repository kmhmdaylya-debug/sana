import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { apiErrorMessage } from '../lib/api';
import { Eye, EyeOff, LogIn, Moon, Sun } from 'lucide-react';
import { applyTheme, readTheme } from '../lib/theme';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => { document.title = 'ورود | سنا'; }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('نام کاربری و گذرواژه الزامی است.');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password, remember);
      toast('success', 'خوش آمدید!');
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <button type="button" className="header-icon-btn login-theme" title={theme === 'dark' ? 'تم روشن' : 'تم تیره'} aria-label={theme === 'dark' ? 'فعال کردن تم روشن' : 'فعال کردن تم تیره'} onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); applyTheme(next); }}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><img src="/favicon.svg" alt="" width={40} height={40} /><div><strong>سنا</strong><small>سامانه مدیریت منابع انسانی</small></div></div>
        <h1>ورود به حساب کاربری</h1>
        <p className="login-caption">اطلاعات حساب سازمانی خود را وارد کنید.</p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="login-fields">
          <Field label="نام کاربری" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="نام کاربری"
              dir="ltr"
              required
            />
          </Field>
          <Field label="گذرواژه" required>
            <div className="password-control">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              dir="ltr"
            />
            <button type="button" className="icon-button" aria-label={showPassword ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه'} title={showPassword ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </Field>
          <label className="checkbox-row">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>مرا به خاطر بسپار</span>
          </label>
          <Button type="submit" className="btn-block" loading={loading}>
            <LogIn size={17} />ورود به سامانه
          </Button>
        </div>
        <div className="login-footer">سنا · مدیریت منابع انسانی</div>
      </form>
    </div>
  );
}
