import React, { createContext, ReactNode } from 'react';
import { EventEmitter } from 'events';


class CoinbaseWsFeed extends EventEmitter {
  ws: WebSocket | null;

  closed: boolean = false;
  open: boolean = false;
  error: any = null;

  unitsSubscribedMap: { [key: string]: { lastCalled: Date | null }} = {};

  timeout = 2500;

  constructor(timeout: number = 2500) {
    super();
    this.ws = null;
    this.timeout = timeout
  }

  async connect() {
    if (this.ws && this.open) {
      console.error('WebSocket already connected, returning existing connection');
      return this.ws;
    }
    if (this.closed) {
      console.error('WebSocket connection was closed opening new one');
    }
    this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    this.ws.onclose = () => {
      console.log('ws closed');
      this.closed = true;
      this.open = false;
    };
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.error = error;
      this.close();
    };
    this.ws.onmessage = this.handleMessage.bind(this);

    this.ws.onopen = () => {
      console.log('ws opened');
      this.open = true;
    }
  }

  close() {
    this.unitsSubscribedMap = {};
    if (!this.ws) {
      console.error('WebSocket not connected, cannot close');
      return;
    }
    console.log('Closing WebSocket connection');
    this.ws.close();
  }

  addSubscription(product_id: string, onEventCallback: (data: any) => void): (where?: string) => void {
    const ws = this.ws;
    if (!ws || this.closed || this.error) {
      console.error('WebSocket not connected, cannot add subscription', this.error);
      return () => {};
    }
    if (!this.unitsSubscribedMap[product_id]) {
      console.log(`Sending new subscription for "${product_id}"`);
      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ name: 'ticker', product_ids: [product_id] }],
      });

      if (!this.open) {
        ws.onopen = () => ws.send(message);
      } else {
        ws.send(message);
      }
      this.unitsSubscribedMap[product_id] = { lastCalled: null };
    }

    console.log(`Adding listener for "${product_id}"`);

    // Add listener for the event
    this.on(product_id, onEventCallback);

    // Return unsubscribe function
    return (where) => {
      const beforeListenerCount = this.listenerCount(product_id);
      this.removeListener(product_id, onEventCallback);
      const afterListenerCount = this.listenerCount(product_id);
      const unSubFromFeed = afterListenerCount === 0;
      console.log('Removing listener', {
        where,
        for: product_id,
        beforeListenerCount,
        afterListenerCount,
        unSubFromFeed,
      })
      if (unSubFromFeed) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          channels: [{ name: 'ticker', product_ids: [product_id] }],
        }))
        delete this.unitsSubscribedMap[product_id];
      }
    }
  }

  handleMessage(event: any) {
    const data = JSON.parse(event.data);
    if (data.type !== 'ticker') {
      return;
    }
    const product_id = data.product_id;
    if (!product_id || !this.unitsSubscribedMap[product_id]) {
      return;
    }
    const lastCalled = this.unitsSubscribedMap[product_id].lastCalled;
    if (!lastCalled || new Date().getTime() - lastCalled.getTime() > this.timeout) {
      this.emit(product_id, data);
      this.unitsSubscribedMap[product_id].lastCalled = new Date();
    } 
  }
}

interface CoinbaseWsContextType {
  addSubscription: (product_id: string, onEventCallback: (data: any) => void) => (where?: string) => void;
}

const CoinbaseWsContext = React.createContext<CoinbaseWsContextType>({
  addSubscription: () => {
    console.error('CoinbaseWsContext not initialized');
    return () => {
      console.error('CoinbaseWsContext not initialized, unsubscribe function not available');
    };
  },
});

export const useCoinbaseWsContext = () => {
  return React.useContext(CoinbaseWsContext);
};

export const CoinbaseWsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cbWsRef = React.useRef<CoinbaseWsFeed | null>(null);

  React.useEffect(() => {
    cbWsRef.current = new CoinbaseWsFeed();
    cbWsRef.current.connect();

    const cbWsCurrent = cbWsRef.current;
    return () => {
      cbWsCurrent?.close();
      cbWsRef.current = null;
    };
  }, []);

  const addSubscription = React.useCallback(
    (product_id: string, onEventCallback: (data: any) => void) => {
      if (!cbWsRef.current) {
        console.error('CoinbaseWsFeed not initialized');
        return () => {
          console.error('CoinbaseWsFeed not initialized, unsubscribe function not available');
        };
      }

      return cbWsRef.current.addSubscription(product_id, onEventCallback);
    },
    [],
  );

  return (
    <CoinbaseWsContext.Provider value={{ addSubscription }}>{children}</CoinbaseWsContext.Provider>
  );
};


export const usePriceFeed = (product_id: string) => {
  const { addSubscription } = useCoinbaseWsContext();
  const [price, setPrice] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const onPriceChangeCb = (data: any) => {
      setPrice(parseFloat(data?.price || '0'));
      setLoading(false);
    };

    const removeSubscription = addSubscription(product_id, onPriceChangeCb);
    return () => removeSubscription();
  }, [addSubscription, product_id]);

  return { price, loading };
};
