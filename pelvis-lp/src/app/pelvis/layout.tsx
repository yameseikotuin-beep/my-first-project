import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SurveyProvider } from '@/components/SurveyProvider';

export default function PelvisLayout({ children }: { children: React.ReactNode }) {
  return (
    <SurveyProvider>
      <Header />
      <main className="mx-auto max-w-3xl px-4">{children}</main>
      <Footer />
    </SurveyProvider>
  );
}
