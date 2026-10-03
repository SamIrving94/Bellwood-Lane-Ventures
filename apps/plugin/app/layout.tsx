import type { ReactNode } from 'react';

type RootLayoutProperties = {
  readonly children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html lang="en-GB">
    <body
      style={{
        margin: 0,
        fontFamily: 'Georgia, serif',
        background: '#F7F3EA',
        color: '#1F332B',
      }}
    >
      {children}
    </body>
  </html>
);

export default RootLayout;
