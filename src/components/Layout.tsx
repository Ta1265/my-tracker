import React from 'react';
import TopNav from './TopNav';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main
        className="
        dark
        flex
        flex-col
        items-center
        justify-center
      "
      >
        <div
          className="
           mx-auto
         "
        >
          <TopNav />
          <div className="px-5 py-5">{children}</div>
        </div>
      </main>
    </>
  );
}
