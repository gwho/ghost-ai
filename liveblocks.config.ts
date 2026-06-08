declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      thinking: boolean;
    };

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Storage: {};

    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        color: string;
      };
    };

    RoomEvent:
      | { type: 'ai-status'; message: string; status: 'start' | 'processing' | 'complete' | 'error' };

    FeedMessageData: {
      sender: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    ThreadMetadata: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    RoomInfo: {};
  }
}

export {};
