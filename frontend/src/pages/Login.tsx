import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { apiErrorMessage } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">س</div>
        <h1 style={{ textAlign: 'center', margin: '0 0 4px', fontSize: 19 }}>سامانهٔ مدیریت منابع انسانی «سنا»</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, marginTop: 0 }}>
          برای ورود، نام کاربری و گذرواژهٔ خود را وارد کنید.
        </p>

        {error && <div className="alert alert-danger mb">{error}</div>}

        <div className="col" style={{ gap: 14 }}>
          <Field label="نام کاربری" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="مثلاً admin"
            />
          </Field>
          <Field label="گذرواژه" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <label className="checkbox-row">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>مرا به خاطر بسپار</span>
          </label>
          <Button type="submit" className="btn-block" loading={loading}>
            ورود به سامانه
          </Button>
        </div>
      </form>
    </div>
  );
}
