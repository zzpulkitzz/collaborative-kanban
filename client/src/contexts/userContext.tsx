import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;

}

interface Board {
    id: string;
    title: string;
    description?: string;
    backgroundColor?: string;
  }
  
const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await axios.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(response.data.data.user);
        initializeSocket(token);
        
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSocket = (token: string) => {
      const newSocket = io('http://localhost:3001', { auth: { token } });
      newSocket.on('connect', () => console.log('🔗 Connected to server'));
      newSocket.on('disconnect', () => console.log('📡 Disconnected from server'));
      setSocket(newSocket);
    };

    
      


  return (
    <UserContext.Provider value={{ user, setUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
