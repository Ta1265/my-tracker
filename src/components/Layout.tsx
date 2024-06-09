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
        h-screen
      "
        style={{
        }}
      >
        
      <TopNav />
        {/* <div
          className="
           mx-auto
         "
        > */}
        {/* </div> */}

        {children}
      </main>
    </>
  );
}
