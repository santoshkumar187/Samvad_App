import React from 'react'
import axios from 'axios'
import { MdSearch, MdOutlineCameraAlt, MdOutlineEdit, MdDoneAll, MdMoreVert, MdLogout, MdDeleteSweep, MdPushPin, MdOutlinePushPin, MdGroupAdd, MdGroup } from 'react-icons/md'

const AVATAR_COLORS = [
  '#4e5149', '#963d1e', '#593c66', '#2e4a66', 
  '#335c5c', '#6b4f3b', '#485e6b', '#5c4e4e'
];

export default function UserList({ currentUser, users, selectedUser, onSelectUser, onDeleteAccount, onLogout, onDeleteSpecificUser, onCameraClick, onProfileUpdate, serverUrl, onViewImage, onAddFriend, onTogglePinChat }) {
  const [showSettings, setShowSettings] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [aboutText, setAboutText] = React.useState(currentUser?.about || 'Available');
  const [profilePicFile, setProfilePicFile] = React.useState(null);
  const [searchId, setSearchId] = React.useState('');
  const [searchResult, setSearchResult] = React.useState(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const cameraInputRef = React.useRef(null);
  const profilePicInputRef = React.useRef(null);

  // Group creation states
  const [showCreateGroupModal, setShowCreateGroupModal] = React.useState(false);
  const [groupName, setGroupName] = React.useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = React.useState([]);
  const [groupAvatarFile, setGroupAvatarFile] = React.useState(null);
  const groupAvatarInputRef = React.useRef(null);

  const [contextMenu, setContextMenu] = React.useState(null); // { x, y, user }

  React.useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('scroll', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('scroll', handleGlobalClick);
    };
  }, [contextMenu]);

  const touchTimerRef = React.useRef(null);
  const touchStartPos = React.useRef({ x: 0, y: 0 });

  const handleTouchStart = (e, user) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      const menuWidth = 160;
      const menuHeight = 100;
      let x = touch.clientX;
      let y = touch.clientY;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
      
      setContextMenu({ x, y, user });
      if (navigator.vibrate) navigator.vibrate(50);
      touchTimerRef.current = null;
    }, 600);
  };

  const handleTouchMove = (e) => {
    if (touchTimerRef.current) {
      const touch = e.touches[0];
      const diffX = Math.abs(touch.clientX - touchStartPos.current.x);
      const diffY = Math.abs(touch.clientY - touchStartPos.current.y);
      if (diffX > 10 || diffY > 10) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleContextMenu = (e, user) => {
    e.preventDefault();
    const menuWidth = 160;
    const menuHeight = 100;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
    
    setContextMenu({ x, y, user });
  };

  const toggleMemberSelection = (userId) => {
    setSelectedGroupMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }
    if (selectedGroupMembers.length === 0) {
      alert('Please select at least one member to invite');
      return;
    }

    const formData = new FormData();
    formData.append('name', groupName.trim());
    formData.append('members', JSON.stringify(selectedGroupMembers));
    if (groupAvatarFile) {
      formData.append('avatar', groupAvatarFile);
    }

    try {
      const res = await axios.post(`${serverUrl}/api/groups`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowCreateGroupModal(false);
      setGroupName('');
      setSelectedGroupMembers([]);
      setGroupAvatarFile(null);
      
      if (onSelectUser) {
        onSelectUser(res.data);
      }
      alert(`Group "${res.data.name}" created successfully!`);
    } catch (err) {
      console.error(err);
      alert('Failed to create group');
    }
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchId.trim()) {
      setIsSearching(true);
      setSearchResult(null);
      try {
        const res = await axios.get(`${serverUrl}/api/search?samvadId=${encodeURIComponent(searchId.trim())}`);
        setSearchResult(res.data);
      } catch (err) {
        setSearchResult({ error: 'User not found' });
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleAddFriendClick = (friendId) => {
    if (onAddFriend) onAddFriend(friendId);
    setSearchResult(null);
    setSearchId('');
  };
  
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('about', aboutText);
    if (profilePicFile) formData.append('profile_pic', profilePicFile);
    if (onProfileUpdate) onProfileUpdate(formData);
    setShowProfileModal(false);
  };
  
  const handleCameraChange = (e) => {
    const file = e.target.files[0];
    if (file && onCameraClick) {
      onCameraClick(file);
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const getAvatarColor = (id) => {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
  };

  return (
    <div className="user-list-sidebar">
      <div className="sidebar-header">
        <div 
          className="user-avatar" 
          style={{ margin: 0, width: '38px', height: '38px', fontSize: '1rem', background: '#333', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            if (currentUser.profile_pic) onViewImage(currentUser.profile_pic.startsWith('http') ? currentUser.profile_pic : `${serverUrl}${currentUser.profile_pic}`);
            else setShowProfileModal(true);
          }}
        >
          {currentUser.profile_pic ? (
            <img src={currentUser.profile_pic.startsWith('http') ? currentUser.profile_pic : `${serverUrl}${currentUser.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            currentUser.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="search-bar">
          <MdSearch size={22} color="#8e8e93" />
          <input 
            type="text" 
            placeholder="Search samvadId (e.g. user#1234)" 
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        <div className="settings-trigger" style={{ position: 'relative' }}>
          <MdMoreVert 
            size={24} 
            color="#8e8e93" 
            style={{ cursor: 'pointer' }} 
            onClick={() => setShowSettings(!showSettings)}
          />
          {showSettings && (
            <>
              <div 
                className="dropdown-overlay" 
                onClick={() => setShowSettings(false)} 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998,
                  background: 'transparent',
                  cursor: 'default'
                }} 
              />
              <div className="header-dropdown" style={{ left: 'auto', right: 0, zIndex: 999 }}>
                <div className="dropdown-item" onClick={() => { setShowCreateGroupModal(true); setShowSettings(false); }}>
                  <MdGroupAdd /> Create Group
                </div>
                <div className="dropdown-item" onClick={() => { setShowProfileModal(true); setShowSettings(false); }}>
                  <MdOutlineEdit /> Edit Profile
                </div>
                <div className="dropdown-item" onClick={() => { onLogout(); setShowSettings(false); }}>
                  <MdLogout /> Logout
                </div>
                <div className="dropdown-item" onClick={() => { onDeleteAccount(); setShowSettings(false); }} style={{ color: '#eb5757' }}>
                  <MdDeleteSweep /> Delete Account
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {searchResult && (
        <div className="search-results-section" style={{ padding: '10px', borderBottom: '1px solid #222', background: '#111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>SEARCH RESULT</span>
            <span style={{ fontSize: '0.8rem', color: '#888', cursor: 'pointer' }} onClick={() => setSearchResult(null)}>Close</span>
          </div>
          {searchResult.error ? (
            <p style={{ fontSize: '0.9rem', color: '#eb5757' }}>{searchResult.error}</p>
          ) : (
            <div className="user-item" style={{ background: '#1a1a1a', borderRadius: '10px', padding: '10px' }}>
              <div className="user-avatar" style={{ background: getAvatarColor(searchResult.id) }}>
                {searchResult.profile_pic ? (
                  <img src={`${serverUrl}${searchResult.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  searchResult.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="user-info">
                <h4>{searchResult.username}</h4>
                <p style={{ fontSize: '0.8rem' }}>{searchResult.samvad_id}</p>
              </div>
              <button 
                className="primary-btn" 
                style={{ padding: '5px 10px', fontSize: '0.8rem', width: 'auto' }}
                onClick={() => handleAddFriendClick(searchResult.id)}
              >
                Connect
              </button>
            </div>
          )}
        </div>
      )}

      <div className="users-container">
        {users.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--signal-text-muted)', marginTop: '2rem' }}>
            No other users available.
          </p>
        ) : (
          users.map(user => (
            <div 
              key={user.isGroup ? `group-${user.id}` : `user-${user.id}`} 
              className={`user-item ${selectedUser?.id === user.id && !!selectedUser?.isGroup === !!user.isGroup ? 'active' : ''}`}
              onClick={() => onSelectUser(user)}
              onContextMenu={(e) => handleContextMenu(e, user)}
              onTouchStart={(e) => handleTouchStart(e, user)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="user-avatar" 
                style={{ background: getAvatarColor(user.id), cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (user.isGroup) {
                    if (user.avatar) onViewImage(user.avatar);
                    else onSelectUser(user);
                  } else {
                    if (user.profile_pic) onViewImage(user.profile_pic.startsWith('http') ? user.profile_pic : `${serverUrl}${user.profile_pic}`);
                    else onSelectUser(user);
                  }
                }}
              >
                {user.isGroup ? (
                  user.avatar ? (
                    <img src={user.avatar} alt="grp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )
                ) : (
                  user.profile_pic ? (
                    <img src={user.profile_pic.startsWith('http') ? user.profile_pic : `${serverUrl}${user.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )
                )}
                {!user.isGroup && <span className={`status-indicator ${user.online ? 'online' : 'offline'}`}></span>}
              </div>
              <div className="user-info">
                <div className="user-info-top">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user.isGroup ? user.name : user.username}
                    {user.samvad_id === 'ai#9999' && <span className="ai-bot-pill-badge">AI BOT</span>}
                    {user.isGroup && <span className="ai-bot-pill-badge" style={{ backgroundColor: 'var(--brand-violet)' }}>GROUP</span>}
                  </h4>
                  <span className="time-snippet" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!!user.is_pinned && <MdPushPin size={14} style={{ color: '#a855f7', transform: 'rotate(45deg)' }} />}
                    {user.isGroup ? 'Group Chat' : (user.samvad_id === 'ai#9999' ? 'Active 24/7' : (user.online ? 'Online' : new Date(user.last_seen).toLocaleDateString()))}
                  </span>
                </div>
                <div className="user-info-bottom">
                  <p>{user.isGroup ? `${user.members?.length || 0} members` : (user.about || 'Available')}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="fab-container">
        <div className="fab camera" onClick={() => cameraInputRef.current.click()}>
          <MdOutlineCameraAlt />
        </div>
        <div className="fab edit" onClick={() => setShowProfileModal(true)}>
          <MdOutlineEdit />
        </div>
      </div>

      <input 
        type="file" 
        className="hidden-input" 
        ref={cameraInputRef}
        onChange={handleCameraChange}
        accept="image/*"
        capture="environment"
      />

      {showProfileModal && (
        <div className="forward-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="forward-modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '5px' }}>Your samvadId: <strong style={{ color: 'var(--signal-blue)' }}>{currentUser?.samvad_id}</strong></p>
            <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="user-avatar" style={{ width: '60px', height: '60px', fontSize: '1.5rem', background: '#333' }}>
                  {profilePicFile ? (
                    <img src={URL.createObjectURL(profilePicFile)} alt="preview" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : currentUser?.profile_pic ? (
                    <img src={currentUser.profile_pic.startsWith('http') ? currentUser.profile_pic : `${serverUrl}${currentUser.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    currentUser?.username.charAt(0).toUpperCase()
                  )}
                </div>
                <button type="button" className="secondary-btn" onClick={() => profilePicInputRef.current.click()} style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                  Change Photo
                </button>
                <input 
                  type="file" 
                  className="hidden-input" 
                  ref={profilePicInputRef}
                  onChange={e => setProfilePicFile(e.target.files[0])}
                  accept="image/*"
                />
              </div>
              <div className="input-wrapper" style={{ border: '1px solid #333' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="About" 
                  value={aboutText}
                  onChange={e => setAboutText(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="primary-btn" style={{ flex: 1, padding: '10px' }}>Save</button>
                <button type="button" className="cancel-btn" onClick={() => setShowProfileModal(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <div className="forward-modal-overlay" onClick={() => setShowCreateGroupModal(false)}>
          <div className="forward-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3>Create Group</h3>
            <form onSubmit={handleCreateGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="user-avatar" style={{ width: '60px', height: '60px', fontSize: '1.5rem', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {groupAvatarFile ? (
                    <img src={URL.createObjectURL(groupAvatarFile)} alt="grp preview" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <MdGroup size={30} color="#888" />
                  )}
                </div>
                <button type="button" className="secondary-btn" onClick={() => groupAvatarInputRef.current.click()} style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                  Choose Group Avatar
                </button>
                <input 
                  type="file" 
                  className="hidden-input" 
                  ref={groupAvatarInputRef}
                  onChange={e => setGroupAvatarFile(e.target.files[0])}
                  accept="image/*"
                />
              </div>
              <div className="input-wrapper" style={{ border: '1px solid #333' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Group Name" 
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '8px', display: 'block' }}>Select Members to Invite:</label>
                <div className="invite-members-list" style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #222', borderRadius: '8px', padding: '10px', background: '#111' }}>
                  {users.filter(u => !u.isGroup && u.samvad_id !== 'ai#9999').length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#666', textAlign: 'center', padding: '10px 0' }}>No friends to invite. Connect with users first.</p>
                  ) : (
                    users.filter(u => !u.isGroup && u.samvad_id !== 'ai#9999').map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', borderRadius: '6px', background: selectedGroupMembers.includes(u.id) ? 'rgba(168, 85, 247, 0.15)' : 'transparent', transition: 'all 0.2s' }}>
                        <input 
                          type="checkbox" 
                          id={`member-${u.id}`}
                          checked={selectedGroupMembers.includes(u.id)}
                          onChange={() => toggleMemberSelection(u.id)}
                          style={{ accentColor: 'var(--brand-violet)', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor={`member-${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', cursor: 'pointer' }}>
                          <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '0.8rem', background: getAvatarColor(u.id) }}>
                            {u.profile_pic ? (
                              <img src={u.profile_pic.startsWith('http') ? u.profile_pic : `${serverUrl}${u.profile_pic}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              u.username.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span style={{ fontSize: '0.9rem', color: '#eee' }}>{u.username}</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" className="primary-btn" style={{ flex: 1, padding: '10px', background: 'var(--brand-violet)', border: 'none' }}>Create Group</button>
                <button type="button" className="cancel-btn" onClick={() => setShowCreateGroupModal(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="chat-context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 9999,
            background: 'rgba(18, 18, 18, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '6px 0',
            minWidth: '160px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="context-menu-item"
            style={{
              padding: '10px 16px',
              fontSize: '0.9rem',
              color: '#eee',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background 0.2s'
            }}
            onClick={() => {
              if (onTogglePinChat) {
                onTogglePinChat(contextMenu.user.id, !contextMenu.user.is_pinned, contextMenu.user.isGroup);
              }
              setContextMenu(null);
            }}
          >
            <MdPushPin style={{ transform: contextMenu.user.is_pinned ? 'none' : 'rotate(45deg)', color: 'var(--brand-violet)', fontSize: '1.1rem' }} />
            {contextMenu.user.is_pinned ? 'Unpin Chat' : 'Pin Chat'}
          </div>

          {/* Delete Option */}
          {contextMenu.user.samvad_id !== 'ai#9999' && (
            <div 
              className="context-menu-item"
              style={{
                padding: '10px 16px',
                fontSize: '0.9rem',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.2s',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)'
              }}
              onClick={async () => {
                const user = contextMenu.user;
                setContextMenu(null);
                if (user.isGroup) {
                  if (currentUser && user.creator_id === currentUser.id) {
                    if (window.confirm(`Are you sure you want to delete the group "${user.name}"? This will permanently delete all messages and remove all members.`)) {
                      try {
                        await axios.delete(`${serverUrl}/api/groups/${user.id}`);
                      } catch (err) {
                        alert(err.response?.data?.error || 'Failed to delete group');
                      }
                    }
                  } else {
                    alert('Only the group creator can delete this group.');
                  }
                } else {
                  onDeleteSpecificUser(user.id, user.username);
                }
              }}
            >
              <MdDeleteSweep style={{ fontSize: '1.2rem' }} />
              {contextMenu.user.isGroup ? 'Delete Group' : 'Delete Chat'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
