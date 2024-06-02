import Link from 'next/link';
import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Dropdown } from 'flowbite-react';
import AddTransaction from './AddTransaction';

const TopNav: React.FC<{}> = ({}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session, status } = useSession();

  const links = [
    {
      label: 'Portfolio',
      href: '/stats',
    },
  ];

  return (
    <>
      <nav
        className="
        xs:p-2
        mx-auto
        flex
        w-full
        max-w-[915px]
        items-center
        justify-center
        border-b-[1px]
        border-gray-700
        sm:p-2
        md:p-6
        lg:p-6
        lg:text-2xl
        xl:p-6
      "
        style={
          {
            // minWidth: '915px',
            // maxWidth: '915px',
          }
        }
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
        <div className="ml-5 flex flex-wrap justify-center">
          <button
            className="
            lg:text-md
            hover:border-grey-700
            font-b
            bg-gray-700
            px-1
            py-2
            text-white
            dark:bg-black
          "
            onClick={() => setIsOpen(true)}
          >
            Add Transaction
          </button>
        </div>

        <div
          className="ml-auto flex space-x-5 sm:text-xl "
          style={{ zIndex: 999 }}
        >
          <div className="relative">
            {status === 'loading' ? (
              <></>
            ) : session?.isAuthenticated ? (
              <Dropdown
                className="z-999 sm:text-md fixed bg-gray-700 dark:bg-black"
                arrowIcon={true}
                inline
                label={session?.user.username}
              >
                <Dropdown.Header className="sm:text-md py-2">
                  <span className="block py-1 text-white">
                    {session?.user.name}
                  </span>
                  <span className="block truncate py-1 font-medium text-white">
                    {session?.user.email}
                  </span>
                </Dropdown.Header>
                <Dropdown.Divider className="border-b-2" />
                <Dropdown.Item
                  className="sm:text-md z-999 py-5 text-white"
                  onClick={() => signOut()}
                >
                  Sign out
                </Dropdown.Item>
              </Dropdown>
            ) : (
              <button
                className="
              hover:border-grey-700
              font-b
              z-999
              ml-auto
              bg-gray-700
              px-1
              py-2
              text-xl
              text-white
              dark:bg-black
              sm:text-lg
            "
                onClick={() => signIn()}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      <AddTransaction
        isOpen={isOpen || false}
        setIsOpen={(value) => setIsOpen(value)}
      />
    </>
  );
};

export default TopNav;
