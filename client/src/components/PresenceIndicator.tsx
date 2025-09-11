import React from 'react';

interface PresenceUser {
  userId: string;
  username: string;
  fullName?: string;
  avatar?: string;
  joinedAt: Date;
}

interface PresenceIndicatorProps {
  users: PresenceUser[];
  totalUsers: number;
  currentUserId: string;
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ 
  users, 
  totalUsers, 
  currentUserId 
}) => {
  // Filter out current user from display
  const otherUsers = users.filter(user => user.userId !== currentUserId);
  const displayUsers = otherUsers.slice(0, 3); // Show max 3 avatars
  const remainingCount = Math.max(0, otherUsers.length - 3);

  if (totalUsers <= 1) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>You're online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Online Status Indicator */}
      <div className="flex items-center space-x-1 text-sm text-green-600">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="font-medium">{totalUsers} online</span>
      </div>

      {/* User Avatars */}
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <div
            key={user.userId}
            className="relative group"
            title={user.fullName || user.username}
          >
            <div className="w-8 h-8 bg-primary-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-semibold hover:scale-110 transition-transform cursor-pointer">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {user.fullName || user.username}
            </div>
          </div>
        ))}

        {/* Remaining Users Counter */}
        {remainingCount > 0 && (
          <div 
            className="w-8 h-8 bg-gray-400 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-semibold"
            title={`${remainingCount} more user${remainingCount > 1 ? 's' : ''}`}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {/* User List Dropdown (Optional) */}
      <div className="relative group">
        <button className="text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Dropdown List */}
        <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-20">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b border-gray-100 mb-1">
            Online Users ({totalUsers})
          </div>
          {users.map((user) => (
            <div key={user.userId} className="flex items-center space-x-2 px-3 py-1 hover:bg-gray-50">
              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.fullName || user.username}
                  {user.userId === currentUserId && (
                    <span className="text-gray-500 ml-1">(You)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">@{user.username}</p>
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PresenceIndicator;
