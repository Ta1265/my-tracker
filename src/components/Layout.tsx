import React from 'react';
import TopNav from './TopNav';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main
        className="
        justify-top
        dark
        flex
        h-screen
        flex-col
        items-center
      "
        style={{
          touchAction: 'none',
        }}
      >
        {/* <div
          className="
           mx-auto
         "
        > */}
        <TopNav />
        {/* </div> */}

        {/* <div className="px-5 py-5"> */}
        {children}
        {/* </div> */}
      </main>
    </>
  );
}
