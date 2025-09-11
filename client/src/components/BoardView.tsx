import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import ConfirmationModal from './ConfirmationModal';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import PresenceIndicator from './PresenceIndicator';

// Add these state variables to BoardView component


// Add this interface near the top
interface PresenceUser {
  userId: string;
  username: string;
  fullName?: string;
  avatar?: string;
  joinedAt: Date;
}
interface User {
  id: string;
  username: string;
  fullName?: string;
  avatar?: string;
}

interface Card {
  id: string;
  title: string;
  description?: string;
  position: number;
  columnId: string;
  assigneeId?: string;
  dueDate?: string;
  labels?: string[];
  priority: 'low' | 'medium' | 'high';
  assignee?: User;
}

interface Column {
  id: string;
  title: string;
  position: number;
  boardId: string;
  cards?: Card[];
}

interface Board {
  id: string;
  title: string;
  description?: string;
  backgroundColor?: string;
  columns?: Column[];
  owner?: User;
}

interface BoardViewProps {
  boardId: string;
  onBack: () => void;
  user?: User;
}

const BoardView: React.FC<BoardViewProps> = ({ boardId, onBack,user }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [deleteCardModal, setDeleteCardModal] = useState<{
    isOpen: boolean;
    cardId: string | null;
    cardTitle: string;
  }>({
    isOpen: false,
    cardId: null,
    cardTitle: ''
  });
  const [origActive, setOrigActive] = useState<any>(null);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [totalOnlineUsers, setTotalOnlineUsers] = useState(0);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchBoard();
    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [boardId]);
  console.log("origActiveColID",origActive?.data?.current?.card?.columnId,"origActiveCardID",origActive?.data?.current?.card?.id)
  console.log("board",board)
  const fetchBoard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setBoard(response.data.data.board);
      }
    } catch (error) {
      console.error('Failed to fetch board:', error);
      alert('❌ Failed to load board');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
  
    const newSocket = io('/', { auth: { token } });
    
    newSocket.on('connect', () => {
      console.log('🔗 Connected to board', boardId);
      newSocket.emit('join_board', boardId);
    });
  
    // Existing event listeners...
    newSocket.on('card_created', (data) => {
      console.log('New card created:', data);
      fetchBoard();
    });
  
    newSocket.on('card_updated', (data) => {
      console.log('Card updated:', data);
      fetchBoard();
    });
  
    newSocket.on('card_moved', (data) => {
      console.log('Card moved:', data);
      fetchBoard();
    });
  
    // NEW: Presence event listeners
    newSocket.on('presence_updated', (data) => {
      console.log('Presence updated:', data);
      setPresenceUsers(data.users);
      setTotalOnlineUsers(data.totalUsers);
    });
  
    newSocket.on('user_joined', (data) => {
      console.log(`👋 ${data.user.username} joined the board`);
      // Optional: show a brief notification
    });
  
    newSocket.on('user_left', (data) => {
      console.log(`👋 ${data.user.username} left the board`);
      // Optional: show a brief notification
    });
  
    setSocket(newSocket);
  };

  const createCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/cards', {
        title: newCardTitle,
        columnId,
        description: 'New card created from board'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setNewCardTitle('');
        setActiveColumnId(null);
        fetchBoard(); // Refresh to get updated data
      }
    } catch (error) {
      console.error('Failed to create card:', error);
      alert('❌ Failed to create card');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log("drag start")
    const { active } = event;
    console.log("intiial columnid ",active.data.current?.card.columnId)
    setOrigActive(()=>active)
    if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card);
    }
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    console.log("drag over")
    const { active, over } = event;
    
    if (!over) return;
    
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    
    // Dragging a card over a column
    if (activeType === 'card' && overType === 'column') {
      const activeCard = active.data.current?.card;
      const overColumn = over.data.current?.column;
      
      // If card is already in the target column, do nothing
      if (activeCard?.columnId === overColumn?.id) return;
      
      // Move card to new column optimistically
      setBoard(prevBoard => {
        if (!prevBoard?.columns) return prevBoard;
        
        return {
          ...prevBoard,
          columns: prevBoard.columns.map(column => {
            // Remove card from source column
            if (column.id === activeCard.columnId) {
              return {
                ...column,
                cards: column.cards?.filter(card => card.id !== activeCard.id) || []
              };
            }
            
            // Add card to target column
            if (column.id === overColumn.id) {
              return {
                ...column,
                cards: [...(column.cards || []), { ...activeCard, columnId: overColumn.id }]
              };
            }
            
            return column;
          })
        };
      });
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    console.log("drag end orig active",origActive?.data?.current?.card?.columnId)
    const { active, over } = event;
    
    setActiveCard(null);
    
    if (!over || !board) return;
    
    const activeType = origActive?.data?.current?.type;
    const overType = over.data.current?.type;
    console.log("type",activeType,overType)
    // Card dropped on column
    if (activeType === 'card' && overType === 'column' )  {
      const activeCard = origActive?.data?.current?.card;
      const overColumn = over.data.current?.column;
      console.log("active",activeCard?.columnId,"over",overColumn?.id)
      if (activeCard?.columnId !== overColumn?.id) {
        console.log("here")
        await moveCardToColumn(activeCard?.id, overColumn?.id, 0);
      }
    }

    if (activeType === 'card' && overType === 'card' )  {
        const activeCard = origActive?.data?.current?.card;
        const overCard = over.data.current?.card;
        console.log("active",activeCard?.columnId,"over",overCard?.columnId)
        if (activeCard?.columnId !== overCard?.columnId) {
          console.log("here")
          await moveCardToColumn(activeCard?.id, overCard?.columnId, 0);
        }
      }
    
    // Card dropped on card (reordering within column or between columns)
    if (activeType === 'card' && overType === 'card') {
      const activeCard = origActive?.data?.current?.card;
      const overCard = over.data.current?.card;
      console.log(activeCard,overCard)
      const activeColumn = board.columns?.find(col => col.cards?.some(card => card.id === activeCard?.id));
      const overColumn = board.columns?.find(col => col.cards?.some(card => card.id === overCard?.id));
      console.log("col",activeColumn,overColumn)
      if (!activeColumn || !overColumn) return;
      
      if (activeColumn.id === overColumn.id) {
        // Reordering within same column
        const cards = activeColumn.cards || [];
        const activeIndex = cards.findIndex(card => card.id === activeCard.id);
        const overIndex = cards.findIndex(card => card.id === overCard.id);
        console.log("index",activeIndex,overIndex)
        if (activeIndex !== overIndex) {
            console.log("heyer")
          const reorderedCards = arrayMove(cards, activeIndex, overIndex);
          
          // Update local state optimistically
          setBoard(prevBoard => {
            if (!prevBoard?.columns) return prevBoard;
            
            return {
              ...prevBoard,
              columns: prevBoard.columns.map(column => 
                column.id === activeColumn.id 
                  ? { ...column, cards: reorderedCards }
                  : column
              )
            };
          });
          
          // Update backend
          await moveCardToColumn(activeCard.id, overColumn.id, overIndex);
        }
      } else {
        // Moving to different column
        console.log("heyer")
        const overCardIndex = overColumn.cards?.findIndex(card => card.id === overCard.id) || 0;
        await moveCardToColumn(activeCard.id, overColumn.id, overCardIndex);
      }
    }
    setOrigActive(active)
  };
  
  // Enhanced moveCardToColumn function
  const moveCardToColumn = async (cardId: string, targetColumnId: string, newPosition: number) => {
    try {
        console.log("moved")
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/cards/move', {

        cardId,
        targetColumnId,
        newPosition
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (response.data.success) {
        // Refresh board data to get accurate positions
        fetchBoard();
      }
    } catch (error) {
      console.error('Failed to move card:', error);
      alert('❌ Failed to move card');
      // Revert optimistic update by refetching
      fetchBoard();
    }
  };
  const findCardById = (cardId: string): Card | null => {
    if (!board?.columns) return null;
    
    for (const column of board.columns) {
      const card = column.cards?.find(card => card.id === cardId);
      if (card) return card;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        <div className="ml-4 text-xl text-gray-600">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Board not found</h2>
          <button onClick={onBack} className="btn-primary">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const deleteCard = async () => {
    if (!deleteCardModal.cardId) return;
    
    setIsDeletingCard(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/cards/${deleteCardModal.cardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (response.data.success) {
        fetchBoard(); // Refresh board data
        setDeleteCardModal({ isOpen: false, cardId: null, cardTitle: '' });
      }
    } catch (error: any) {
      console.error('Failed to delete card:', error);
      alert('❌ Failed to delete card');
    } finally {
      setIsDeletingCard(false);
    }
  };
  
  // Add this before the return statement in BoardView
  const openDeleteCardModal = (cardId: string, cardTitle: string) => {
    console.log("felete intialitesd")
    setDeleteCardModal({
      isOpen: true,
      cardId,
      cardTitle
    });
  };

  
  console.log(deleteCardModal)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800 flex items-center"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{board.title}</h1>
              {board.description && (
                <span className="text-gray-500">• {board.description}</span>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-yellow-800">
                🧪 <strong>Testing Board ID:</strong> 
                <code className="bg-yellow-200 px-2 py-1 rounded ml-2 font-mono text-xs">
                    {boardId}
                </code>
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                Share this URL with other test users: 
                <code className="bg-yellow-200 px-2 py-1 rounded ml-1 font-mono">
                    {window.location.origin}/board/{boardId}
                </code>
                </p>
                <button 
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}`)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1 rounded mt-2 transition-colors"
                >
                📋 Copy URL
                </button>
            </div>
            )}
            <PresenceIndicator 
        users={presenceUsers}
        totalUsers={totalOnlineUsers}
        currentUserId={user?.id || ''} // You'll need to pass current user
      />
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex space-x-6 p-6 min-w-max">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {board.columns?.map((column) => (
              <Column
                key={column.id}
                column={column}
                isAddingCard={activeColumnId === column.id}
                newCardTitle={newCardTitle}
                onNewCardTitleChange={setNewCardTitle}
                onStartAddingCard={() => setActiveColumnId(column.id)}
                onCancelAddingCard={() => setActiveColumnId(null)}
                onCreateCard={() => createCard(column.id)}
                onDeleteCard={openDeleteCardModal} 
              />
              
            ))}

            {/* Drag Overlay */}
            {createPortal(
              <DragOverlay>
              {activeCard ? (
                <div className="bg-white rounded-lg p-3 shadow-2xl border-2 border-primary-300 w-80 transform rotate-3 scale-110">
                  <h4 className="font-medium text-gray-900 mb-1">{activeCard.title}</h4>
                  {activeCard.description && (
                    <p className="text-sm text-gray-600 mb-2">{activeCard.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    {activeCard.labels && activeCard.labels.length > 0 && (
                      <div className="flex space-x-1">
                        {activeCard.labels.map((label, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {activeCard.assignee && (
                      <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {activeCard.assignee.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </DragOverlay>,
              document.body
            )}
          </DndContext>
        </div>
        
      </div>
      
    </div>
  );
};

// Column Component
const Column: React.FC<{
    column: Column;
    isAddingCard: boolean;
    newCardTitle: string;
    onNewCardTitleChange: (title: string) => void;
    onStartAddingCard: () => void;
    onCancelAddingCard: () => void;
    onCreateCard: () => void;
    onDeleteCard: (cardId: string, cardTitle: string) => void;
  }> = ({ 
    column, 
    isAddingCard, 
    newCardTitle, 
    onNewCardTitleChange,
    onStartAddingCard,
    onCancelAddingCard,
    onCreateCard,
    onDeleteCard
  }) => {
    const cardIds = column.cards?.map(card => card.id) || [];
  
    const {
      isOver,
      setNodeRef: setDroppableNodeRef
    } = useDroppable({
      id: column.id,
      data: {
        type: 'column',
        column: column,
      },
    });
  
    return (
      <div 
        ref={setDroppableNodeRef}
        className={`bg-gray-100 rounded-lg p-4 w-80 flex-shrink-0 transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''
        }`}
      >
        {/* Column Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">{column.title}</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {column.cards?.length || 0}
            </span>
            {isOver && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            )}
          </div>
        </div>
  
        {/* Cards List */}
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className={`space-y-3 min-h-[2rem] rounded-lg transition-all ${
            isOver ? 'bg-blue-25 border-blue-200' : ''
          }`}>
            {column.cards?.map((card) => (
              <CardItem key={card.id} card={card} onDelete={onDeleteCard} />
            ))}
            
            {/* Drop Indicator */}
            {isOver && column.cards?.length === 0 && (
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                <p className="text-blue-500 font-medium">Drop card here</p>
              </div>
            )}
          </div>
        </SortableContext>
  
        {/* Add Card Section - Same as before */}
        {isAddingCard ? (
          <div className="mt-3 p-3 bg-white rounded-lg border-2 border-primary-200">
            <textarea
              value={newCardTitle}
              onChange={(e) => onNewCardTitleChange(e.target.value)}
              placeholder="Enter card title..."
              className="w-full text-sm border-none focus:outline-none resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-between items-center mt-2">
              <button
                onClick={onCreateCard}
                className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded"
                disabled={!newCardTitle.trim()}
              >
                Add Card
              </button>
              <button
                onClick={onCancelAddingCard}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onStartAddingCard}
            className="mt-3 w-full text-left p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add a card
          </button>
        )}
      </div>
    );
  };
// Card Component
const CardItem: React.FC<{ 
    card: Card; 
    onDelete: (cardId: string, cardTitle: string) => void;
  }> = ({ card, onDelete }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: card.id,
      data: {
        type: 'card',
        card: card,
      },
    });
  
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
  
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group ${
          isDragging ? 'opacity-50 rotate-2 scale-105' : ''
        }`}
      >
        {/* Drag Handle */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-gray-900 flex-1 pr-2">{card.title}</h4>
          <div className="flex items-center space-x-1">
            {/* Drag Handle Icon */}
            <button
              {...listeners}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-all duration-200 p-1 rounded cursor-grab active:cursor-grabbing"
              title="Drag card"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
            
            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card.id, card.title);
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all duration-200 p-1 rounded hover:bg-red-50"
              title="Delete card"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
  
        {card.description && (
          <p className="text-sm text-gray-600 mb-2">{card.description}</p>
        )}
        
        <div className="flex items-center justify-between">
          {card.labels && card.labels.length > 0 && (
            <div className="flex space-x-1">
              {card.labels.map((label, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          
          {card.assignee && (
            <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {card.assignee.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    );
  };
// Card Preview for Drag Overlay
const CardPreview: React.FC<{ card: Card }> = ({ card }) => {
  return (
    <div className="bg-white rounded-lg p-3 shadow-lg border border-gray-300 w-80 transform rotate-2">
      <h4 className="font-medium text-gray-900 mb-1">{card.title}</h4>
      {card.description && (
        <p className="text-sm text-gray-600">{card.description}</p>
      )}
    </div>
  );
};

export default BoardView;
