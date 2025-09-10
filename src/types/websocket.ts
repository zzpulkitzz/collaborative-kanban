export interface SocketUser {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  }
  
  export interface WebSocketEvent {
    type: string;
    boardId?: string;
    userId: string;
    timestamp: Date;
    data?: any;
  }
  
  export interface PresenceUpdate {
    boardId: string;
    userId: string;
    username: string;
    action: 'join' | 'leave';
    timestamp: Date;
  }
  
  export interface CardUpdateEvent extends WebSocketEvent {
    type: 'CARD_UPDATED' | 'CARD_MOVED' | 'CARD_CREATED' | 'CARD_DELETED';
    data: {
      cardId: string;
      columnId?: string;
      changes?: any;
    };
  }
  
  export interface TypingIndicator {
    cardId: string;
    userId: string;
    username: string;
    isTyping: boolean;
  }
  