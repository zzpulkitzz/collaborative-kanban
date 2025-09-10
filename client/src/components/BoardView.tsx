import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
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
}

const BoardView: React.FC<BoardViewProps> = ({ boardId, onBack }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

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

    // Listen for real-time updates
    newSocket.on('card_created', (data) => {
      console.log('New card created:', data);
      fetchBoard(); // Refresh board data
    });

    newSocket.on('card_updated', (data) => {
      console.log('Card updated:', data);
      fetchBoard(); // Refresh board data
    });

    newSocket.on('card_moved', (data) => {
      console.log('Card moved:', data);
      fetchBoard(); // Refresh board data
    });

    newSocket.on('user_joined', (data) => {
      console.log(`👋 ${data.user.username} joined the board`);
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
    const { active } = event;
    const activeCardData = findCardById(active.id as string);
    setActiveCard(activeCardData);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic for better UX
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !board) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    
    // Find the target column
    const targetColumn = board.columns?.find(col => 
      col.id === overId || col.cards?.some(card => card.id === overId)
    );
    
    if (!targetColumn) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/cards/move', {
        cardId: activeCardId,
        targetColumnId: targetColumn.id,
        newPosition: 0 // Simple positioning for now
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Optimistically update local state or fetch fresh data
      fetchBoard();
    } catch (error) {
      console.error('Failed to move card:', error);
      alert('❌ Failed to move card');
    }

    setActiveCard(null);
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
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ● Connected
              </span>
            </div>
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
              />
            ))}

            {/* Drag Overlay */}
            {createPortal(
              <DragOverlay>
                {activeCard ? <CardPreview card={activeCard} /> : null}
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
}> = ({ 
  column, 
  isAddingCard, 
  newCardTitle, 
  onNewCardTitleChange,
  onStartAddingCard,
  onCancelAddingCard,
  onCreateCard
}) => {
  const cardIds = column.cards?.map(card => card.id) || [];

  return (
    <div className="bg-gray-100 rounded-lg p-4 w-80 flex-shrink-0">
      {/* Column Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">{column.title}</h3>
        <span className="text-sm text-gray-500">
          {column.cards?.length || 0}
        </span>
      </div>

      {/* Cards List */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 min-h-[2rem]">
          {column.cards?.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>

      {/* Add Card */}
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
const CardItem: React.FC<{ card: Card }> = ({ card }) => {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow">
      <h4 className="font-medium text-gray-900 mb-1">{card.title}</h4>
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
