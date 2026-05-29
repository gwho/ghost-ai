declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      isThinking: boolean;
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

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    RoomEvent: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    ThreadMetadata: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    RoomInfo: {};
  }
}

export {};
