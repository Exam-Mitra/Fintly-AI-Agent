import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Chat from './pages/Chat.jsx';
import Settings from './pages/Settings.jsx';
import SavedItems from './pages/SavedItems.jsx';
import FlashcardSets from './pages/FlashcardSets.jsx';
import Flashcards from './pages/Flashcards.jsx';
import SharedChat from './pages/SharedChat.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import TokenRequestNotifier from './components/TokenRequestNotifier.jsx';
import BroadcastBanner from './components/BroadcastBanner.jsx';

export default function App() {
  return (
    <>
      <BroadcastBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved"
          element={
            <ProtectedRoute>
              <SavedItems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <FlashcardSets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flashcards/:setId"
          element={
            <ProtectedRoute>
              <Flashcards />
            </ProtectedRoute>
          }
        />
        {/* Public, read-only — deliberately NOT wrapped in ProtectedRoute so
            anyone with a shared link can view it without signing in. */}
        <Route path="/share/:shareId" element={<SharedChat />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TokenRequestNotifier />
    </>
  );
}
