'use client';

import React from 'react';
import { EventEmitter } from 'events';


const subscribeMessage = (product_id: string, type: 'subscribe' | 'unsubscribe'): string =>
  JSON.stringify({ type, channels: [{ name: 'ticker', product_ids: [product_id] }] });

class CoinbaseWsFeed extends EventEmitter {
  ws: WebSocket | null;

  unitsSubscribedMap: { [key: string]: { lastCalled: Date | null }} = {};

  timeout = 2500;

  constructor(timeout: number = 2500) {
    super();
    this.ws = null;
    this.timeout = timeout
  }

  private get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private get isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }

  /** Sends only on an OPEN socket. Any other state is a no-op rather than a throw. */
  private trySend(message: string): void {
    if (!this.isOpen || !this.ws) {
      return;
    }
    try {
      this.ws.send(message);
    } catch (error) {
      console.error('CoinbaseWsFeed: send failed', error);
    }
  }

  connect() {
    if (this.isOpen || this.isConnecting) {
      return this.ws;
    }

    const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    this.ws = ws;

    // Subscriptions are recorded in unitsSubscribedMap the moment they are requested and
    // sent from here, so ones requested mid-connect are delivered rather than dropped, and
    // a reconnect restores everything that was subscribed on the previous socket.
    ws.addEventListener('open', () => {
      console.log('ws opened');
      for (const product_id of Object.keys(this.unitsSubscribedMap)) {
        this.trySend(subscribeMessage(product_id, 'subscribe'));
      }
    });

    ws.addEventListener('message', (event) => this.handleMessage(event));

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.addEventListener('close', () => {
      console.log('ws closed');
    });

    return ws;
  }

  close() {
    // unitsSubscribedMap is deliberately left intact: it is the record of what should be
    // subscribed, and connect() replays it so a reconnect restores the live subscriptions.
    if (!this.ws) {
      return;
    }
    console.log('Closing WebSocket connection');
    this.ws.close();
  }

  addSubscription(product_id: string, onEventCallback: (data: any) => void): (where?: string) => void {
    if (!this.unitsSubscribedMap[product_id]) {
      console.log(`Sending new subscription for "${product_id}"`);
      this.unitsSubscribedMap[product_id] = { lastCalled: null };

      if (this.isOpen) {
        this.trySend(subscribeMessage(product_id, 'subscribe'));
      }
    }

    // Outside the new-product check on purpose: close() keeps unitsSubscribedMap, so after a
    // drop the already-mapped products are exactly the ones that still need the socket back.
    if (!this.isOpen) {
      this.connect();
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
        delete this.unitsSubscribedMap[product_id];
        this.trySend(subscribeMessage(product_id, 'unsubscribe'));
      }
    }
  }

  handleMessage(event: any) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      console.error('CoinbaseWsFeed: could not parse feed message', error);
      return;
    }
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
  // Built during render rather than in the effect so a child that subscribes on its own
  // first render finds a feed; the constructor opens no socket, so this stays SSR-safe.
  const cbWsRef = React.useRef<CoinbaseWsFeed | null>(null);
  if (cbWsRef.current === null) {
    cbWsRef.current = new CoinbaseWsFeed();
  }

  React.useEffect(() => {
    const cbWsCurrent = cbWsRef.current;
    cbWsCurrent?.connect();

    return () => {
      cbWsCurrent?.close();
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
