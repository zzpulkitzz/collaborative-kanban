export interface CreateBoardRequest {
    title: string;
    description?: string;
    backgroundColor?: string;
  }
  
  export interface UpdateBoardRequest {
    title?: string;
    description?: string;
    backgroundColor?: string;
  }
  
  export interface CreateColumnRequest {
    title: string;
    position: number;
    boardId: string;
  }
  
  export interface CreateCardRequest {
    title: string;
    description?: string;
    columnId: string;
    assigneeId?: string;
    dueDate?: Date;
    labels?: string[];
    position: number;
  }
  
  export interface MoveCardRequest {
    cardId: string;
    sourceColumnId: string;
    targetColumnId: string;
    newPosition: number;
  }
  
  export type AuditAction = 
    | 'BOARD_CREATED' 
    | 'BOARD_UPDATED' 
    | 'BOARD_DELETED'
    | 'COLUMN_CREATED' 
    | 'COLUMN_UPDATED' 
    | 'COLUMN_DELETED'
    | 'CARD_CREATED' 
    | 'CARD_UPDATED' 
    | 'CARD_MOVED' 
    | 'CARD_DELETED'
    | 'CARD_ASSIGNED';
  