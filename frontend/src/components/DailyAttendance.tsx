import { useEffect, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';

export default function DailyAttendance() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const timeZone = 'Asia/Tehran';
  const dateText = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone, weekday:'long', year:'numeric', month:'long', day:'numeric' }).format(now);
  const timeText = new Intl.DateTimeFormat('fa-IR', { timeZone, hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).format(now);
  return <div className="employee-day-bar">
    <span className="employee-day-date"><CalendarDays size={17} />{dateText}</span>
    <time className="employee-day-time" dateTime={new Date(now).toISOString()}><Clock size={16} /><span dir="ltr">{timeText}</span></time>
  </div>;
}
