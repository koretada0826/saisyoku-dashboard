"use client";

import {
  LayoutDashboard,
  Filter,
  BarChart3,
  Table2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string; // 画面内の実在セクションへのアンカー
};

// 実際に機能する(該当セクションへスクロールする)項目だけを表示。
const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", icon: LayoutDashboard, href: "#top" },
  { label: "ファネル分析", icon: Filter, href: "#funnel" },
  { label: "KPI分析", icon: BarChart3, href: "#kpi" },
  { label: "データ一覧", icon: Table2, href: "#table" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col bg-[var(--color-navy)] px-5 py-7 lg:flex">
      {/* ロゴ = ブランドピンク */}
      <div className="mb-8 flex items-center gap-3 px-1">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand-pink)] shadow-sm">
          <Activity className="h-6 w-6 text-white" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-base font-bold text-white">Funnel Analytics</p>
          <p className="text-xs text-white/60">歩留まり分析</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5" aria-label="メインナビゲーション">
        {NAV_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const active = i === 0;
          return (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-brand-pink)] font-semibold text-white shadow-sm"
                  : "text-white/75 hover:bg-[var(--color-navy-soft)] hover:text-white",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* 下部: ブランド3色の帯(パレット提示) */}
      <div className="mt-auto pt-6">
        <div className="flex h-1.5 overflow-hidden rounded-full">
          <span className="flex-1 bg-[var(--color-brand-blue)]" />
          <span className="flex-1 bg-[var(--color-brand-purple)]" />
          <span className="flex-1 bg-[var(--color-brand-pink)]" />
        </div>
        <p className="mt-2 px-1 text-[11px] text-white/50">モックデータ表示中</p>
      </div>
    </aside>
  );
}
