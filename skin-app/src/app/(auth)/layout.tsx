import { Brand, LegalFooter } from '@/components/brand';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="border-b border-line bg-surface/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Brand />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        {children}
      </main>
      <LegalFooter />
    </>
  );
}
