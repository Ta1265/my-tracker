// contexts/ReloadContext.tsx
import { createContext, useState, useContext } from 'react';

type ReloadContextType = {
  onReload?: () => void;
  reload: boolean;
  triggerReload: () => void;
};

export const ReloadContext = createContext<ReloadContextType>({
  onReload: () => {},
  reload: false,
  triggerReload: () => {},
});

export const useReload = () => useContext(ReloadContext);

export const ReloadProvider: React.FC<any> = ({ onReload, children }) => {
  const [reload, setReload] = useState(false);

  const triggerReload = () => {
    setReload(!reload);
    onReload();
  };

  return (
    <ReloadContext.Provider value={{ reload, triggerReload }}>{children}</ReloadContext.Provider>
  );
};
