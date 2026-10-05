import { Brand, LegalFooter } from '@/components/brand';
import { NavLinks, type NavItem } from '@/components/nav-links';
import { logout } from '@/app/(auth)/actions';
import { roleLabels, type AppRole } from '@/lib/auth/roles';

type Props = {
  children: React.ReactNode;
  nav: NavItem[];
  displayName: string;
  role: AppRole;
  homeHref: string;
  /** 'tabs'：スマホ向けの下部タブ（一般ユーザー）、'side'：PC 向けの左メニュー（スタッフ・管理者） */
  layout: 'tabs' | 'side';
};

export function AppShell({ children, nav, displayName, role, homeHref, layout }: Props) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Brand href={homeHref} />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-muted sm:inline">
              {displayName || '（表示名なし）'}・{roleLabels[role]}
            </span>
            <form action={logout}>
              <button type="submit" className="min-h-11 rounded-full px-3 text-sage-strong transition-colors hover:bg-sage-soft active:bg-sage-soft active:scale-[0.97]">
                ログアウト
              </button>
            </form>
          </div>
        </div>
        {layout === 'side' ? (
          <div className="border-t border-line lg:hidden">
            <NavLinks items={nav} variant="scroll" />
          </div>
        ) : (
          <div className="hidden border-t border-line sm:block">
            <div className="mx-auto max-w-6xl">
              <NavLinks items={nav} variant="scroll" />
            </div>
          </div>
        )}
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4">
        {layout === 'side' ? (
          <aside className="hidden w-52 shrink-0 py-8 lg:block print:hidden">
            <NavLinks items={nav} variant="side" />
          </aside>
        ) : null}
        <main id="main" className={`min-w-0 flex-1 py-6 sm:py-8 ${layout === 'tabs' ? 'pb-28 sm:pb-8' : ''}`}>
          {children}
        </main>
      </div>
      {layout === 'tabs' ? <NavLinks items={nav} variant="tabs" /> : null}
      <div className="print:hidden">
        <LegalFooter />
      </div>
    </>
  );
}
