// contexts/ReloadContext.tsx
import { createContext, useState, useContext } from 'react';

type ReloadContextType = {
  reload: boolean;
  triggerReload: () => void;
};

export const ReloadContext = createContext<ReloadContextType>({
  reload: false,
  triggerReload: () => {},
});

export const useReload = () => useContext(ReloadContext);

export const ReloadProvider: React.FC<any> = ({ children }) => {
  const [reload, setReload] = useState(false);

  const triggerReload = () => {
    setReload(!reload);
  };

  return (
    <ReloadContext.Provider value={{ reload, triggerReload }}>
      {children}
    </ReloadContext.Provider>
  );
};
