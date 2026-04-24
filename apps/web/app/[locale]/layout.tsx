import { Toolbar as CMSToolbar } from '@repo/cms/components/toolbar';
import { DesignSystemProvider } from '@repo/design-system';
import { Toolbar } from '@repo/feature-flags/components/toolbar';
import { getDictionary } from '@repo/internationalization';
import type { ReactNode } from 'react';
import { Footer } from './components/footer';
import { Header } from './components/header';

type LocaleLayoutProperties = {
  readonly children: ReactNode;
  readonly params: Promise<{
    locale: string;
  }>;
};

const LocaleLayout = async ({ children, params }: LocaleLayoutProperties) => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return (
    <DesignSystemProvider>
      <Header dictionary={dictionary} />
      {children}
      <Footer />
      <Toolbar />
      <CMSToolbar />
    </DesignSystemProvider>
  );
};

export default LocaleLayout;
