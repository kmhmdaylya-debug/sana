import { Home, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return <section className="empty-state" aria-labelledby="not-found-heading">
    <SearchX size={32} aria-hidden="true" />
    <p className="text-muted">۴۰۴</p>
    <h1 id="not-found-heading" style={{ fontSize: 24 }}>صفحه یافت نشد</h1>
    <Link to="/" className="btn btn-secondary"><Home size={17} /> خانه</Link>
  </section>;
}
