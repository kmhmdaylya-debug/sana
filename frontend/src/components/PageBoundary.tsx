import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

export default class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    if (this.state.failed) return <div className="table-state" role="alert"><TriangleAlert size={28} /><h2>نمایش این صفحه ممکن نشد</h2><p>لطفاً دوباره تلاش کنید.</p><button type="button" className="btn btn-primary" onClick={()=>{ window.location.reload(); }}>بارگذاری دوباره</button></div>;
    return this.props.children;
  }
}
