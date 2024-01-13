import Link from 'next/link';
import Image from 'next/image';
import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Avatar, Dropdown, Navbar } from 'flowbite-react';

export const TopNav: React.FC<{}> = ({}) => {
  const { data: session, status } = useSession();

  const links = [
    {
      label: 'Portfolio',
      href: '/stats',
    },
  ];

  return (
    <nav
      className="
        lg:text-md
        mx-auto
        flex
        w-full
        min-w-[850px]
        items-center
        justify-center
        border-b-[1px]
        border-gray-700
        p-6
        text-3xl
        md:text-xl
      "
    >
      <div className="flex flex-wrap justify-center space-x-4">
        {links.map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="
            hover:text-grey-200
            hover:border-grey-700
            text-white
          "
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="ml-auto flex space-x-5">
        {status === 'loading' ? (
          <></>
        ) : session?.isAuthenticated ? (
          <Dropdown
            className="bg-gray-700 dark:bg-black"
            arrowIcon={true}
            inline
            label={session?.user.username}
          >
            <Dropdown.Header className="py-2">
              <span className="block py-1 text-3xl text-white md:text-lg">
                {session?.user.name}
              </span>
              <span className="block truncate py-1 text-2xl font-medium text-white md:text-lg">
                {session?.user.email}
              </span>
            </Dropdown.Header>
            <Dropdown.Divider className="border-b-2" />
            <Dropdown.Item
              className="py-5 text-3xl text-white md:text-xl"
              onClick={() => signOut()}
            >
              Sign out
            </Dropdown.Item>
          </Dropdown>
        ) : (
          <button
            className="
              lg:text-md
              hover:border-grey-700
              font-b
              ml-auto
              bg-gray-700
              px-1
              py-2
              text-3xl
              text-white
              dark:bg-black
              md:text-xl
            "
            onClick={() => signIn()}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
};
