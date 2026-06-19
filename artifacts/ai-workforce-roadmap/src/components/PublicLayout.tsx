import { Link, useLocation } from "wouter";
import { Zap, Menu, X } from "lucide-react";
import { useState } from "react";

function PublicHeader() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/features", label: "Tính năng" },
    { href: "/pricing", label: "Bảng giá" },
    { href: "/demo", label: "Demo" },
    { href: "/contact", label: "Liên hệ" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg">
          <Zap className="w-5 h-5 text-amber-400" />
          <span>AI Workforce</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location === href
                  ? "text-amber-400 bg-amber-500/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2">
            Đăng nhập
          </Link>
          <Link
            href="/demo"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            Dùng thử AI SDR
          </Link>
        </div>

        <button
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 px-6 py-4 space-y-2">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5"
            >
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <Link href="/login" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-slate-400 hover:text-white">
              Đăng nhập
            </Link>
            <Link href="/demo" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 bg-amber-500 text-black text-sm font-semibold rounded-lg text-center">
              Dùng thử AI SDR
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-black border-t border-white/10 py-12 mt-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-white text-lg mb-3">
              <Zap className="w-5 h-5 text-amber-400" />
              AI Workforce
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Nền tảng AI Workforce giúp doanh nghiệp triển khai đội ngũ nhân viên AI tự động hoá sales, marketing và vận hành.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Sản phẩm</p>
            <div className="space-y-2">
              {[
                { href: "/features", label: "Tính năng" },
                { href: "/pricing", label: "Bảng giá" },
                { href: "/demo", label: "Demo miễn phí" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="block text-sm text-slate-400 hover:text-white transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Công ty</p>
            <div className="space-y-2">
              {[
                { href: "/contact", label: "Liên hệ" },
                { href: "/login", label: "Đăng nhập" },
                { href: "/register", label: "Đăng ký" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="block text-sm text-slate-400 hover:text-white transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-500 text-xs">© 2026 AI Workforce. All rights reserved.</p>
          <p className="text-slate-600 text-xs">Powered by OpenAI GPT-4o</p>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <PublicHeader />
      <main className="pt-16">{children}</main>
      <PublicFooter />
    </div>
  );
}
