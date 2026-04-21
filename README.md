# Samvad App - Premium Full-Stack Chat Application

![Samvad App Banner](https://img.shields.io/badge/Samvad%20App-Premium%20Violet-8b5cf6?style=for-the-badge)

Samvad App is a high-fidelity, real-time messaging platform designed with a focus on premium aesthetics and fluid user interactions. Inspired by modern design systems like Signal and WhatsApp, it offers a seamless communication experience across both desktop and mobile devices.

## ✨ Key Features

### 🎨 Advanced Personalization
- **16 Premium Themes**: Choose from curated backgrounds like *Stellar Dot*, *Mesh Glow*, *Cyber Neon*, and more.
*   **Custom Wallpapers**: Upload your own images from your gallery to create a personalized chat environment.
*   **Dynamic Violet Identity**: A custom glassmorphic UI built around a sophisticated `#8b5cf6` palette.

### 📱 Superior UX/UI
*   **Snap-to-Reply**: High-fidelity gesture support (swipe from left to right) for intuitive message replies with elastic rubber physics.
*   **Bottom Sheet Navigation**: Native-feeling slide-up sheets for profile settings, message forwarding, and context menus on mobile.
*   **Glassmorphic Design**: Modern, translucent elements with backdrop blur for a professional appearance.

### 💬 Core Messaging
*   **Real-Time Delivery**: Instant messaging powered by Socket.io.
*   **Message Interactions**: Support for pinning messages, reacting with emojis, and bulk/individual deletion.
*   **Universal File Sharing**: Share images, videos, and documents seamlessly.
*   **Profile Viewer**: Immersive, full-screen profile picture viewer with smooth zoom animations.

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), Axios, Socket.io-client, React Icons |
| **Backend** | Node.js, Express, Socket.io, Multer |
| **Database** | MySQL (Pool-based connections) |
| **Styling** | Vanilla CSS (Custom tokens and BEM-style architecture) |

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- MySQL Server

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/santoshkumar187/Samvad_App.git
   cd Samvad_App
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   # Create a .env file with your DB credentials
   npm start
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## 🌐 Production Deployment

### 1. Deploy the Backend
Since this app uses Socket.io, you cannot host the backend on Vercel. Use a service like **Render**, **Railway**, or **DigitalOcean**.
- Push the `backend/` folder to your chosen platform.
- Ensure your MySQL database is accessible from the internet.
- Set up your environment variables (DB credentials) in the hosting provider's dashboard.

### 2. Deploy the Frontend (Vercel)
- Link your GitHub repository to Vercel.
- Set the **Root Directory** to `frontend`.
- Add an **Environment Variable**:
  - Key: `VITE_API_BASE_URL`
  - Value: `https://your-backend-url.onrender.com` (Replace with your actual backend URL).
- Deploy!

---

## 🔒 Security & Performance
- **Local Persistence**: User preferences like chat themes are stored locally for instant loading.
- **Optimized Media**: Server-side file handling for high-resolution images without frontend lag.
- **Clean Codebase**: Minimized repository size with a strictly managed `.gitignore`.

---
Developed with ❤️ by [Santhosh Kumar](https://github.com/santoshkumar187)
