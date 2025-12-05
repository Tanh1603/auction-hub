# 🔌 WebSocket Integration Guide - Auction Hub

This guide explains how to integrate the WebSocket real-time bidding system into your frontend application.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [⚠️ Hybrid Bidding Architecture](#️-critical-hybrid-bidding-architecture) ← **READ THIS FIRST**
4. [Connection Setup](#connection-setup)
5. [Events Reference](#events-reference)
6. [React Integration](#react-integration)
7. [Vue Integration](#vue-integration)
8. [Timer Implementation](#timer-implementation)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## Overview

The Auction Hub uses Socket.IO for real-time bidding communication. The WebSocket server handles:

- **Auction room management** - Users join/leave auction "rooms"
- **Real-time state updates** - Current bids, time remaining, participants
- **Bid notifications** - When someone places a bid
- **Status changes** - Auction start, end, status updates

### Key Concepts

| Concept            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| **Namespace**      | `/bidding` - All auction events use this namespace    |
| **Room**           | `auction:{auctionId}` - Each auction has its own room |
| **Authentication** | JWT token passed via `auth.token` on connection       |

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   WebSocket     │     │   Database      │
│   (React/Vue)   │◄───►│   Gateway       │◄───►│   (PostgreSQL)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │  joinAuction ────────►│
        │◄──────── auctionState │
        │◄──────── newBid       │
        │◄──────── timeUpdate   │
        │  leaveAuction ───────►│
```

### Event Flow

```
User Navigation                    WebSocket Events
================                   ================

1. User navigates to
   /auction/AUC001
        │
        ▼
2. Page mounts, checks
   if user is checked-in
        │
        ▼
3. If checked-in:                 ─────► emit('joinAuction', { auctionId })
        │                                        │
        ▼                                        ▼
4. Receive auction state          ◄───── on('auctionState', data)
        │
        ▼
5. Display bidding UI,
   start local timer
        │
        ▼
6. User places bid                ─────► POST /api/manual-bid
        │                                        │
        ▼                                        ▼
7. Receive bid update             ◄───── on('newBid', data)
        │
        ▼
8. User leaves page               ─────► emit('leaveAuction', auctionId)
```

---

## ⚠️ Critical: Hybrid Bidding Architecture

### Understanding the Bid Flow

**This is the most important concept to understand:**

| Action                  | Protocol             | Endpoint               |
| ----------------------- | -------------------- | ---------------------- |
| **Place a bid**         | REST API (HTTP POST) | `POST /api/manual-bid` |
| **Receive bid updates** | WebSocket            | `on('newBid', data)`   |

### Why Hybrid? Why Not WebSocket for Everything?

1. **Reliability**: HTTP has built-in request/response confirmation
2. **Validation**: REST API validates bids with proper error responses
3. **Transactions**: Database transactions work better with synchronous requests
4. **Security**: Easier to implement rate limiting on REST endpoints

### Detailed Bid Flow

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   CLIENT A       │       │      SERVER      │       │    CLIENT B      │
│   (Bid Placer)   │       │                  │       │   (Spectator)    │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         │  1. POST /api/manual-bid │                          │
         │  {auctionId, amount}     │                          │
         │ ─────────────────────────►                          │
         │                          │                          │
         │                    2. Validate bid                  │
         │                    3. Save to database              │
         │                    4. Call biddingGateway           │
         │                       .emitNewBidWithState()        │
         │                          │                          │
         │                          │ 5. WebSocket 'newBid'    │
         │                          │ ─────────────────────────►
         │                          │                          │
         │  6. HTTP 200 + bid data  │ (Client B receives       │
         │ ◄─────────────────────────  the bid via WebSocket)  │
         │                          │                          │
         │  7. WebSocket 'newBid'   │                          │
         │ ◄─────────────────────────  (Client A ALSO gets     │
         │     (broadcast to ALL)   │   the WebSocket event!)  │
```

### Code: Backend Flow (What Happens on Server)

```typescript
// manual-bid.service.ts

async create(dto: CreateManualBidDto, userId: string) {
  // 1. Validate the bid (user, auction, amount, etc.)
  // 2. Save to database in a transaction
  const result = await this.prisma.$transaction(async (tx) => {
    // ... save bid
    return savedBid;
  });

  // 3. Broadcast to ALL connected clients in the auction room
  await this.biddingGateway.emitNewBidWithState(result.auctionId);

  // 4. Return HTTP response to the bidder
  return result;
}
```

```typescript
// bidding.gateway.ts

async emitNewBidWithState(auctionId: string) {
  const auctionState = await this.getAuctionState(auctionId);
  if (auctionState) {
    // Broadcast to ALL clients in the room (including the bidder!)
    this.server.to(`auction:${auctionId}`).emit('newBid', auctionState);
  }
}
```

### Code: Frontend Implementation

```typescript
// Place bid via REST API
const placeBid = async (amount: number) => {
  try {
    const response = await fetch('/api/manual-bid', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auctionId, amount }),
    });

    if (!response.ok) {
      const error = await response.json();
      showToast(`Bid failed: ${error.message}`);
      return;
    }

    // Success! But don't update UI here...
    // The WebSocket 'newBid' event will update the UI for EVERYONE
    showToast('Bid placed successfully!');
  } catch (error) {
    showToast('Network error');
  }
};

// Receive bid updates via WebSocket
socket.on('newBid', (payload) => {
  // This fires for ALL bids, including your own!
  setAuctionState((prev) => ({
    ...prev,
    winningBid: payload.winningBid,
    nextMinimumBid: payload.nextMinimumBid,
    totalBids: payload.totalBids,
  }));
});
```

### Key Takeaways

| ❌ DON'T                             | ✅ DO                                   |
| ------------------------------------ | --------------------------------------- |
| `socket.emit('placeBid', data)`      | `fetch('/api/manual-bid', {...})`       |
| Update UI on HTTP response           | Update UI on `'newBid'` WebSocket event |
| Assume only others receive WebSocket | Know YOU also receive `'newBid'` event  |

---

## Connection Setup

### Installation

```bash
npm install socket.io-client
```

### Basic Connection

```typescript
import { io, Socket } from 'socket.io-client';

// Configuration
const SOCKET_URL = 'http://localhost:3000';
const NAMESPACE = '/bidding';

// Connect with JWT authentication
const socket: Socket = io(`${SOCKET_URL}${NAMESPACE}`, {
  auth: {
    token: 'your-jwt-token-here',
  },
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

### Connection Events

```typescript
// Connected successfully
socket.on('connect', () => {
  console.log('✅ Connected to auction server');
  console.log('Socket ID:', socket.id);
});

// Disconnected
socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

// Connection error
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// Reconnection attempts
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 Reconnecting... attempt ${attemptNumber}`);
});
```

---

## Events Reference

### Outgoing Events (Client → Server)

#### 1. `joinAuction`

Join an auction room to receive real-time updates.

```typescript
// Emit
socket.emit('joinAuction', { auctionId: 'uuid-of-auction' });

// Response: You'll receive 'auctionState' event
```

#### 2. `leaveAuction`

Leave an auction room.

```typescript
// Emit
socket.emit('leaveAuction', 'uuid-of-auction');

// Response: You'll receive 'leftAuction' confirmation
```

### Incoming Events (Server → Client)

#### 1. `auctionState`

Full auction state sent when you join. **This is your main data source.**

> ⚠️ **Note**: This event is sent WITHOUT a wrapper - the payload IS the data directly.

```typescript
socket.on('auctionState', (state) => {
  // NO { data } wrapper - state is the data directly!
  console.log('Auction State:', {
    auctionId: state.auctionId,
    name: state.name,
    code: state.code,
    status: state.status, // 'scheduled' | 'live' | 'success' | 'no_bid' | 'cancelled'
    hasStarted: state.hasStarted,
    hasEnded: state.hasEnded,
    isActive: state.isActive,
    timeRemaining: state.timeRemaining, // milliseconds
    auctionStartAt: state.auctionStartAt, // ISO timestamp
    auctionEndAt: state.auctionEndAt, // ISO timestamp
    startingPrice: state.startingPrice,
    bidIncrement: state.bidIncrement,
    reservePrice: state.reservePrice, // or null

    // Current winning bid (NOTE: field is called "currentWinningBid")
    currentWinningBid: state.currentWinningBid, // { bidId, amount, bidAt, participantId, bidderName, isWinningBid } or null
    nextMinimumBid: state.nextMinimumBid,
    totalBids: state.totalBids,
    totalParticipants: state.totalParticipants,
    bidHistory: state.bidHistory, // Last 5 bids: [{ bidId, amount, bidAt, bidderName }]
  });
});
```

#### 2. `newBid`

Broadcast when someone places a new bid. **Returns full auction state** (same structure as `auctionState`).

```typescript
socket.on('newBid', (state) => {
  // Same structure as auctionState - full state refresh, NO wrapper
  console.log('New Bid - Updated State:', {
    auctionId: state.auctionId,
    currentWinningBid: state.currentWinningBid,
    nextMinimumBid: state.nextMinimumBid,
    totalBids: state.totalBids,
    bidHistory: state.bidHistory,
  });

  // Update your UI with the new state
});
```

#### 3. `timeUpdate`

Periodic time sync (currently every second). **This event HAS a wrapper.**

```typescript
socket.on('timeUpdate', (payload) => {
  const { data } = payload; // ⚠️ Has { event, data } wrapper

  console.log('Time Update:', {
    auctionId: data.auctionId,
    timeRemaining: data.timeRemaining, // milliseconds
    hasStarted: data.hasStarted,
    hasEnded: data.hasEnded,
    currentWinningBid: data.currentWinningBid,
    nextMinimumBid: data.nextMinimumBid,
    totalBids: data.totalBids,
  });
});
```

#### 4. `bidDenied`

When a bid is denied by admin/auctioneer.

```typescript
socket.on('bidDenied', (data) => {
  // No wrapper - data is passed directly
  console.log('Bid Denied:', {
    bidId: data.bidId,
    auctionId: data.auctionId,
    participantId: data.participantId,
    isDenied: data.isDenied,
    deniedAt: data.deniedAt,
    deniedBy: data.deniedBy,
    deniedReason: data.deniedReason,
  });
});
```

#### 5. `auctionUpdate`

Auction status changed (started, ended, cancelled, etc).

```typescript
socket.on('auctionUpdate', (data) => {
  // When auction ends, includes full state + type
  console.log('Auction Update:', {
    type: data.type, // e.g., 'AUCTION_ENDED'
    auctionId: data.auctionId,
    status: data.status,
    hasEnded: data.hasEnded,
    currentWinningBid: data.currentWinningBid,
    // ...includes full auction state
  });
});
```

#### 6. `error`

Error notifications (returned as acknowledgment from emit).

```typescript
// Errors come as acknowledgment responses, not as separate events
socket.emit('joinAuction', { auctionId }, (response) => {
  if (response.event === 'error') {
    console.error('Error:', response.data.message);
  } else if (response.event === 'joinedAuction') {
    console.log('Successfully joined:', response.data.auctionId);
  }
});
```

#### 7. `joinedAuction` / `leftAuction`

Confirmation events (also returned as acknowledgment).

```typescript
// These come as acknowledgment responses
socket.emit('joinAuction', { auctionId }, (response) => {
  // response = { event: 'joinedAuction', data: { auctionId, message } }
  console.log('Joined auction:', response.data.auctionId);
});

socket.emit('leaveAuction', auctionId, (response) => {
  // response = { event: 'leftAuction', data: { auctionId } }
  console.log('Left auction:', response.data.auctionId);
});
```

---

## React Integration

### 1. Create a Socket Context

```typescript
// contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = (token: string) => {
    const newSocket = io('http://localhost:3000/bidding', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);
  };

  const disconnect = () => {
    socket?.disconnect();
    setSocket(null);
    setIsConnected(false);
  };

  return <SocketContext.Provider value={{ socket, isConnected, connect, disconnect }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
```

### 2. Create an Auction Hook

````typescript
// hooks/useAuction.ts
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

// Match the actual server response structure
interface CurrentWinningBid {
  bidId: string;
  amount: number;
  bidAt: string;
  participantId: string;
  bidderName: string;
  isWinningBid: boolean;
}

interface AuctionState {
  auctionId: string;
  name: string;
  code: string;
  status: 'scheduled' | 'live' | 'success' | 'no_bid' | 'cancelled';
  hasStarted: boolean;
  hasEnded: boolean;
  isActive: boolean;
  timeRemaining: number;
  auctionStartAt: string;
  auctionEndAt: string;
  startingPrice: number;
  bidIncrement: number;
  reservePrice: number | null;
  currentWinningBid: CurrentWinningBid | null;  // ⚠️ Note: NOT "winningBid"
  nextMinimumBid: number;
  totalBids: number;
  totalParticipants: number;
  bidHistory: Array<{ bidId: string; amount: number; bidAt: string; bidderName: string }>;
}

export const useAuction = (auctionId: string, isCheckedIn: boolean) => {
  const { socket, isConnected } = useSocket();
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join auction room on mount (if checked in)
  useEffect(() => {
    if (!socket || !isConnected || !isCheckedIn || !auctionId) return;

    // Join the auction room
    socket.emit('joinAuction', { auctionId });

    // Event handlers - NOTE the different wrapper handling!

    // auctionState: NO wrapper - state IS the payload
    const handleAuctionState = (state: AuctionState) => {
      setAuctionState(state);  // Direct, no .data
      setIsJoined(true);
    };

    // newBid: NO wrapper - returns full auction state
    const handleNewBid = (state: AuctionState) => {
      setAuctionState(state);  // Just replace with new state
    };

    // timeUpdate: HAS wrapper { event, data }
    const handleTimeUpdate = (payload: { event: string; data: Partial<AuctionState> }) => {
      setAuctionState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          timeRemaining: payload.data.timeRemaining ?? prev.timeRemaining,
          hasEnded: payload.data.hasEnded ?? prev.hasEnded,
          currentWinningBid: payload.data.currentWinningBid ?? prev.currentWinningBid,
          nextMinimumBid: payload.data.nextMinimumBid ?? prev.nextMinimumBid,
          totalBids: payload.data.totalBids ?? prev.totalBids,
        };
      });
    };

    // auctionUpdate: NO wrapper
    const handleAuctionUpdate = (data: Partial<AuctionState> & { type?: string }) => {
      if (data.type === 'AUCTION_ENDED') {
        setAuctionState((prev) => prev ? { ...prev, ...data, hasEnded: true } : prev);
      } else {
        setAuctionState((prev) => prev ? { ...prev, status: data.status ?? prev.status } : prev);
      }
    };

    // error: comes as acknowledgment, but also listen for broadcast errors
    const handleError = (payload: { message: string }) => {
      setError(payload.message);
    };

    // Subscribe to events
    socket.on('auctionState', handleAuctionState);
    socket.on('newBid', handleNewBid);
    socket.on('timeUpdate', handleTimeUpdate);
    socket.on('auctionUpdate', handleAuctionUpdate);
    socket.on('error', handleError);

    // Cleanup: Leave auction on unmount
    return () => {
      socket.emit('leaveAuction', auctionId);
      socket.off('auctionState', handleAuctionState);
      socket.off('newBid', handleNewBid);
      socket.off('timeUpdate', handleTimeUpdate);
      socket.off('auctionUpdate', handleAuctionUpdate);
      socket.off('error', handleError);
      setIsJoined(false);
    };
  }, [socket, isConnected, isCheckedIn, auctionId]);

  return { auctionState, isJoined, error };
};
```

### 3. Use in Component

```tsx
// components/AuctionBiddingPanel.tsx
import React from 'react';
import { useAuction } from '../hooks/useAuction';
import { useAuth } from '../contexts/AuthContext'; // Your auth context
import { formatCurrency, formatTime } from '../utils/formatters';

interface Props {
  auctionId: string;
  isCheckedIn: boolean;
}

export const AuctionBiddingPanel: React.FC<Props> = ({ auctionId, isCheckedIn }) => {
  const { auctionState, isJoined, error } = useAuction(auctionId, isCheckedIn);

  // Not checked in - show message
  if (!isCheckedIn) {
    return (
      <div className="bidding-panel disabled">
        <p>⚠️ You must check in before you can bid</p>
      </div>
    );
  }

  // Still connecting/loading
  if (!isJoined || !auctionState) {
    return (
      <div className="bidding-panel loading">
        <p>🔄 Connecting to auction...</p>
      </div>
    );
  }

  // Auction ended
  if (auctionState.hasEnded) {
    return (
      <div className="bidding-panel ended">
        <h3>🏆 Auction Ended</h3>
        {auctionState.winningBid && (
          <p>
            Winner: {auctionState.winningBid.bidderName} <br />
            Amount: {formatCurrency(auctionState.winningBid.amount)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bidding-panel">
      {/* Timer */}
      <div className="timer">⏱️ {formatTime(auctionState.timeRemaining)}</div>

      {/* Current winning bid */}
      {auctionState.winningBid && (
        <div className="winning-bid">
          <h4>🏆 Current Winning Bid</h4>
          <p className="amount">{formatCurrency(auctionState.winningBid.amount)}</p>
          <p className="bidder">by {auctionState.winningBid.bidderName}</p>
        </div>
      )}

      {/* Next minimum bid */}
      <div className="next-bid">
        <p>Minimum next bid: {formatCurrency(auctionState.nextMinimumBid)}</p>
      </div>

      {/* Bid form - you would make an API call here */}
      <BidForm auctionId={auctionId} minimumBid={auctionState.nextMinimumBid} />

      {/* Error display */}
      {error && <div className="error">{error}</div>}
    </div>
  );
};
```

### 4. App Setup

```tsx
// App.tsx
import { SocketProvider } from './contexts/SocketContext';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>{/* Your routes */}</Router>
      </SocketProvider>
    </AuthProvider>
  );
}
```

---

## Vue Integration

### 1. Create a Composable

```typescript
// composables/useSocket.ts
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

const socket = ref<Socket | null>(null);
const isConnected = ref(false);

export function useSocket() {
  const connect = (token: string) => {
    socket.value = io('http://localhost:3000/bidding', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.value.on('connect', () => {
      isConnected.value = true;
    });

    socket.value.on('disconnect', () => {
      isConnected.value = false;
    });
  };

  const disconnect = () => {
    socket.value?.disconnect();
    socket.value = null;
    isConnected.value = false;
  };

  return { socket, isConnected, connect, disconnect };
}
```

### 2. Create Auction Composable

```typescript
// composables/useAuction.ts
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useSocket } from './useSocket';

export function useAuction(auctionId: string, isCheckedIn: boolean) {
  const { socket, isConnected } = useSocket();
  const auctionState = ref(null);
  const isJoined = ref(false);

  const joinAuction = () => {
    if (socket.value && isConnected.value && isCheckedIn) {
      socket.value.emit('joinAuction', { auctionId });
    }
  };

  const leaveAuction = () => {
    if (socket.value) {
      socket.value.emit('leaveAuction', auctionId);
    }
  };

  onMounted(() => {
    if (!socket.value) return;

    socket.value.on('auctionState', (payload) => {
      auctionState.value = payload.data;
      isJoined.value = true;
    });

    socket.value.on('newBid', (payload) => {
      if (auctionState.value) {
        auctionState.value.winningBid = payload.data.isWinningBid ? { amount: payload.data.amount, bidderName: payload.data.bidderName } : auctionState.value.winningBid;
        auctionState.value.nextMinimumBid = payload.data.nextMinimumBid;
      }
    });

    // Join if already connected and checked in
    if (isConnected.value && isCheckedIn) {
      joinAuction();
    }
  });

  onUnmounted(() => {
    leaveAuction();
  });

  return { auctionState, isJoined };
}
```

---

## Timer Implementation

### ⚠️ Recommended: Frontend-Calculated Timer

Instead of relying on backend `timeUpdate` events every second, calculate the timer locally:

```typescript
// hooks/useAuctionTimer.ts
import { useState, useEffect, useRef } from 'react';

export const useAuctionTimer = (
  auctionEndAt: string | null, // From auctionState
  serverTime: string | null // From auctionState
) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);
  const serverOffsetRef = useRef(0);

  // Calculate server offset when we receive auctionState
  useEffect(() => {
    if (serverTime) {
      const serverMs = new Date(serverTime).getTime();
      const clientMs = Date.now();
      serverOffsetRef.current = serverMs - clientMs;
    }
  }, [serverTime]);

  // Calculate initial time remaining
  useEffect(() => {
    if (auctionEndAt) {
      const endMs = new Date(auctionEndAt).getTime();
      const nowMs = Date.now() + serverOffsetRef.current;
      setTimeRemaining(Math.max(0, endMs - nowMs));
    }
  }, [auctionEndAt]);

  // Countdown every second (LOCAL, no network!)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          setHasEnded(true);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return { timeRemaining, hasEnded };
};
```

### Usage

```tsx
const AuctionTimer: React.FC<{ auctionEndAt: string; serverTime: string }> = ({ auctionEndAt, serverTime }) => {
  const { timeRemaining, hasEnded } = useAuctionTimer(auctionEndAt, serverTime);

  if (hasEnded) {
    return <div className="timer ended">Auction Ended</div>;
  }

  return <div className="timer">{formatTime(timeRemaining)}</div>;
};
```

### Why Frontend Timer?

| Backend Timer (Every Second) | Frontend Timer (Recommended) |
| ---------------------------- | ---------------------------- |
| ❌ High network traffic      | ✅ Zero timer traffic        |
| ❌ Database queries/second   | ✅ No DB load for timer      |
| ❌ Latency visible in UI     | ✅ Smooth countdown          |
| ✅ Server-authoritative      | ✅ Synced via auctionEndAt   |

---

## Error Handling

### Connection Errors

```typescript
socket.on('connect_error', (error) => {
  if (error.message === 'Authentication error') {
    // Token expired or invalid - redirect to login
    logout();
    navigate('/login');
  } else {
    // Network error - show reconnection message
    showToast('Connection lost. Reconnecting...');
  }
});
```

### Bid Errors

```typescript
// When placing bid via REST API
const placeBid = async (auctionId: string, amount: number) => {
  try {
    const response = await fetch('/api/manual-bid', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auctionId, amount }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      switch (data.error?.code) {
        case 'BID_TOO_LOW':
          showToast('Your bid is below the minimum!');
          break;
        case 'AUCTION_ENDED':
          showToast('This auction has ended');
          break;
        case 'NOT_CHECKED_IN':
          showToast('You must check in first');
          break;
        default:
          showToast(data.message || 'Failed to place bid');
      }
      return false;
    }

    return true;
  } catch (error) {
    showToast('Network error. Please try again.');
    return false;
  }
};
```

---

## Best Practices

### 1. ✅ Connect Once, Reuse Connection

```typescript
// Good: Single socket instance
const socket = io('/bidding', { auth: { token } });

// Bad: Multiple connections
const socket1 = io('/bidding');
const socket2 = io('/bidding'); // Don't do this!
```

### 2. ✅ Clean Up on Unmount

```typescript
useEffect(() => {
  socket.emit('joinAuction', { auctionId });

  return () => {
    socket.emit('leaveAuction', auctionId); // Always leave!
    socket.off('auctionState');
    socket.off('newBid');
  };
}, [auctionId]);
```

### 3. ✅ Handle Reconnection

```typescript
socket.on('reconnect', () => {
  // Re-join auction after reconnection
  if (currentAuctionId) {
    socket.emit('joinAuction', { auctionId: currentAuctionId });
  }
});
```

### 4. ✅ Use TypeScript Types

```typescript
// types/auction.ts
export interface AuctionStatePayload {
  event: 'auctionState';
  data: {
    auctionId: string;
    status: 'scheduled' | 'live' | 'success' | 'no_bid' | 'cancelled';
    // ...
  };
}

export interface NewBidPayload {
  event: 'newBid';
  data: {
    bidId: string;
    amount: number;
    // ...
  };
}
```

### 5. ✅ Debounce Bid Submissions

```typescript
const debouncedBid = useMemo(() => debounce((amount: number) => placeBid(auctionId, amount), 500), [auctionId]);
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET QUICK REFERENCE                     │
├─────────────────────────────────────────────────────────────────┤
│ URL:        http://localhost:3000/bidding                        │
│ Auth:       { auth: { token: 'JWT_TOKEN' } }                    │
├─────────────────────────────────────────────────────────────────┤
│ EMIT (Client → Server):                                          │
│   • joinAuction({ auctionId })  - Enter auction room            │
│   • leaveAuction(auctionId)     - Leave auction room            │
├─────────────────────────────────────────────────────────────────┤
│ ON (Server → Client):                                            │
│   • auctionState    - Full state on join                        │
│   • newBid          - New bid broadcast                         │
│   • timeUpdate      - Time sync (every second)                  │
│   • bidDenied       - Bid was denied                            │
│   • auctionUpdate   - Status changed                            │
│   • error           - Error notification                        │
├─────────────────────────────────────────────────────────────────┤
│ PLACING BIDS:                                                    │
│   POST /api/manual-bid                                           │
│   Headers: { Authorization: 'Bearer TOKEN' }                     │
│   Body: { auctionId: 'uuid', amount: 2050000000 }               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing

Use the included `websocket-full-test.html` file in the project root to test WebSocket functionality:

```bash
# Start the server
npm run dev

# Open in browser
start websocket-full-test.html
```

Or use the quick test setup script:

```powershell
# Setup a test user with JWT token
.\quick-test-setup.ps1 -UserId "your-user-id"

# The script generates a JWT token you can use for testing
```

---

## Related Documentation

- [Quick Test Setup Guide](./QUICK_TEST_SETUP_GUIDE.md) - Test user setup
- [Postman API Testing Guide](./POSTMAN_API_TESTING_GUIDE.md) - API documentation
- [AsyncAPI Specification](./asyncapi.yml) - WebSocket API spec
````
