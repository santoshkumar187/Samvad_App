import React from 'react'
import axios from 'axios'
import { MdSearch, MdOutlineCameraAlt, MdOutlineEdit, MdDoneAll, MdMoreVert, MdLogout, MdDeleteSweep } from 'react-icons/md'

const AVATAR_COLORS = [
  '#4e5149', '#963d1e', '#593c66', '#2e4a66', 
  '#335c5c', '#6b4f3b', '#485e6b', '#5c4e4e'
];

export default function UserList({ currentUser, users, selectedUser, onSelectUser, onDeleteAccount, onLogout, onDeleteSpecificUser, onCameraClick, onProfileUpdate, serverUrl, onViewImage, onAddFriend }) {
  const [showSettings, setShowSettings] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [aboutText, setAboutText] = React.useState(currentUser?.about || 'Available');
  const [profilePicFile, setProfilePicFile] = React.useState(null);
  const [searchId, setSearchId] = React.useState('');
  const [searchResult, setSearchResult] = React.useState(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const cameraInputRef = React.useRef(null);
  const profilePicInputRef = React.useRef(null);

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
              key={user.id} 
              className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`}
              onClick={() => onSelectUser(user)}
            >
              <div className="user-avatar" 
                style={{ background: getAvatarColor(user.id), cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (user.profile_pic) onViewImage(user.profile_pic.startsWith('http') ? user.profile_pic : `${serverUrl}${user.profile_pic}`);
                  else onSelectUser(user);
                }}
              >
                {user.profile_pic ? (
                  <img src={user.profile_pic.startsWith('http') ? user.profile_pic : `${serverUrl}${user.profile_pic}`} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
                <span className={`status-indicator ${user.online ? 'online' : 'offline'}`}></span>
              </div>
              <div className="user-info">
                <div className="user-info-top">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user.username}
                    {user.samvad_id === 'ai#9999' && <span className="ai-bot-pill-badge">AI BOT</span>}
                  </h4>
                  <span className="time-snippet">
                    {user.samvad_id === 'ai#9999' ? 'Active 24/7' : (user.online ? 'Online' : new Date(user.last_seen).toLocaleDateString())}
                  </span>
                </div>
                <div className="user-info-bottom">
                  <p>{user.about || 'Available'}</p>
                </div>
              </div>
              {user.samvad_id !== 'ai#9999' && (
                <div 
                  className="user-delete-action" 
                  title="Delete this account"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSpecificUser(user.id, user.username);
                  }}
                >
                  <MdDeleteSweep size={20} />
                </div>
              )}
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
    </div>
  )
}
